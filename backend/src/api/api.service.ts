import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import nodemailer, { Transporter } from 'nodemailer';
import { CreateUserDto, StudentsQueryDto, ForcePasswordChangeDto } from './api.dto';

interface ResetPayload {
  userId: string;
  email: string;
  exp: number;
}

interface AttendanceMailPayload {
  parentEmail: string;
  studentName: string;
  status: string;
  timeIn: string;
}

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);
  private readonly supabase: SupabaseClient;
  private readonly supabaseRead: SupabaseClient;
  private readonly supabaseAdmin: SupabaseClient | null;
  private readonly jwtSecret: string;
  private readonly summaryCacheTtlMs = 15_000;
  private studentsSummaryCache: { expiresAt: number; value: any } | null = null;

  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpSecure: boolean;
  private readonly smtpUser: string;
  private readonly smtpPass: string;
  private readonly smtpFromName: string;
  private readonly smtpFromEmail: string;
  private readonly smtpRejectUnauthorized: boolean;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend environment.');
    }

    const supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.supabaseRead = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);
    this.supabaseAdmin = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
      : null;

    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'your-very-secure-secret-key-change-this';

    if (this.jwtSecret.includes('change-this') || this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be set to a strong value (minimum 32 characters).');
    }

    this.smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    this.smtpPort = Number.parseInt(this.configService.get<string>('SMTP_PORT') || '465', 10);
    this.smtpSecure =
      (this.configService.get<string>('SMTP_SECURE') || 'true').toLowerCase() !== 'false';
    this.smtpUser = this.configService.get<string>('SMTP_USER') || '';
    this.smtpPass = this.configService.get<string>('SMTP_PASS') || '';
    this.smtpFromName = this.configService.get<string>('SMTP_FROM_NAME') || 'E-QRAS System';
    this.smtpFromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || this.smtpUser || 'noreply@example.com';
    this.smtpRejectUnauthorized =
      (this.configService.get<string>('SMTP_TLS_REJECT_UNAUTHORIZED') || 'true').toLowerCase() !==
      'false';
  }

  async getStudents(query?: StudentsQueryDto) {
    try {
      const page = Math.max(1, Number(query?.page || 1));
      const limit = Math.min(500, Math.max(1, Number(query?.limit || 100)));
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const search = String(query?.search || '').trim();

      let request = this.supabaseRead
        .from('students')
        .select('*', { count: 'exact' })
        .order('last_name', { ascending: true })
        .range(from, to);

      if (search) {
        const escapedSearch = search.replace(/"/g, '\\"');
        request = request.or(
          `student_id.ilike.%${escapedSearch}%,first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%`
        );
      }

      let { data, error, count } = await request;

      if (error) {
        // Fallback for schemas without last_name column/index.
        const fallback = await this.supabaseRead
          .from('students')
          .select('*', { count: 'exact' })
          .range(from, to);

        if (fallback.error) {
          this.logger.error(`Failed to fetch students: ${fallback.error.message}`);
          return { success: false, error: fallback.error.message, data: [] };
        }

        data = fallback.data || [];
        count = fallback.count ?? data.length;
      }

      const safeData = data || [];
      return {
        success: true,
        data: safeData,
        total: count ?? safeData.length,
        page,
        limit,
        hasMore: safeData.length === limit
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch students.';
      this.logger.error(`Failed to fetch students: ${message}`);
      return { success: false, error: message, data: [] };
    }
  }

  async getStudentsSummary() {
    const nowMs = Date.now();
    if (this.studentsSummaryCache && this.studentsSummaryCache.expiresAt > nowMs) {
      return this.studentsSummaryCache.value;
    }

    try {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
      }).format(new Date());

      const [studentsTotalRes, activeStudentsRes, todayAttendanceRes, recentAttendanceRes] =
        await Promise.all([
          this.supabaseRead
            .from('students')
            .select('student_id', { count: 'exact', head: true }),
          this.supabaseRead
            .from('students')
            .select('student_id', { count: 'exact', head: true })
            .neq('status', 'Inactive'),
          this.supabaseRead
            .from('attendance')
            .select('id, status')
            .eq('scan_date', today),
          this.supabaseRead
            .from('attendance')
            .select('scan_date')
            .order('scan_date', { ascending: false })
            .limit(1000),
        ]);

      if (studentsTotalRes.error) {
        this.logger.warn(`students summary total query failed: ${studentsTotalRes.error.message}`);
      }
      if (activeStudentsRes.error) {
        this.logger.warn(`students summary active query failed: ${activeStudentsRes.error.message}`);
      }
      if (todayAttendanceRes.error) {
        this.logger.warn(`students summary today attendance query failed: ${todayAttendanceRes.error.message}`);
      }
      if (recentAttendanceRes.error) {
        this.logger.warn(`students summary recent attendance query failed: ${recentAttendanceRes.error.message}`);
      }

      const totalStudents = studentsTotalRes.count ?? 0;
      const activeStudents = activeStudentsRes.count ?? 0;
      const todayRows = todayAttendanceRes.data ?? [];
      const recentRows = recentAttendanceRes.data ?? [];

      const todayPresent = todayRows.filter((row) => row.status === 'Present').length;
      const todayAbsent = todayRows.filter((row) => row.status === 'Absent').length;
      const todayLate = todayRows.filter((row) => row.status === 'Late').length;

      const attendanceByDate = recentRows.reduce<Record<string, number>>((acc, row) => {
        if (!row.scan_date) return acc;
        acc[row.scan_date] = (acc[row.scan_date] ?? 0) + 1;
        return acc;
      }, {});

      const recentAttendance = Object.entries(attendanceByDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 7)
        .map(([date, count]) => ({ date, count }));

      const result = {
        generatedAt: new Date().toISOString(),
        totalStudents,
        activeStudents,
        inactiveStudents: Math.max(0, totalStudents - activeStudents),
        today: {
          date: today,
          scanned: todayRows.length,
          present: todayPresent,
          late: todayLate,
          absent: todayAbsent,
        },
        recentAttendance,
      };

      this.studentsSummaryCache = {
        expiresAt: Date.now() + this.summaryCacheTtlMs,
        value: result,
      };

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build summary.';
      this.logger.error(`students summary failed: ${message}`);
      return {
        generatedAt: new Date().toISOString(),
        totalStudents: 0,
        activeStudents: 0,
        inactiveStudents: 0,
        today: {
          date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()),
          scanned: 0,
          present: 0,
          late: 0,
          absent: 0,
        },
        recentAttendance: [],
      };
    }
  }

  generateResetToken(userId: string, email: string) {
    const payload: Omit<ResetPayload, 'exp'> = { userId, email };
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '15m' });

    return { token };
  }

  // ─── Pre-login flows (public, service-role) ───────────────────────────────
  async lookupLoginEmail(identifier: string) {
    const trimmed = (identifier || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Identifier is required.' };
    }

    const isEmail = trimmed.includes('@');
    const query = this.supabaseRead
      .from('users')
      .select('email')
      .limit(1);

    const { data, error } = isEmail
      ? await query.ilike('email', trimmed)
      : await query.eq('username', trimmed);

    if (error) {
      this.logger.error(`lookupLoginEmail failed for ${trimmed}: ${error.message}`);
      return { success: false, error: 'Lookup failed.' };
    }

    const email = data?.[0]?.email || (isEmail ? trimmed : null);
    if (!email) {
      // Don't reveal whether the username exists.
      return { success: true, email: null };
    }

    return { success: true, email };
  }

  async requestPasswordReset(email: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) {
      return { success: false, error: 'Email is required.' };
    }

    const { data: user, error: lookupError } = await this.supabaseRead
      .from('users')
      .select('id, full_name, email')
      .ilike('email', normalized)
      .maybeSingle();

    if (lookupError) {
      this.logger.error(`requestPasswordReset lookup failed for ${normalized}: ${lookupError.message}`);
      return { success: false, error: 'Lookup failed.' };
    }

    // Don't reveal whether the email is registered — but only attempt to send
    // and store an OTP if the account actually exists.
    if (!user) {
      return { success: true };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: updateError } = await this.supabaseRead
      .from('users')
      .update({ otp_code: otp, otp_expiry: expiry })
      .eq('id', user.id);

    if (updateError) {
      this.logger.error(`requestPasswordReset OTP store failed for ${normalized}: ${updateError.message}`);
      return { success: false, error: 'Could not generate OTP.' };
    }

    const sendResult = await this.sendOtpEmail(user.email || normalized, otp);
    if ((sendResult as any).error) {
      return { success: false, error: (sendResult as any).error };
    }

    return { success: true };
  }

  async verifyPasswordResetOtp(email: string, otp: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !otp) {
      return { success: false, error: 'Email and OTP are required.' };
    }

    const { data: user, error } = await this.supabaseRead
      .from('users')
      .select('id, email, otp_code, otp_expiry')
      .ilike('email', normalized)
      .maybeSingle();

    if (error) {
      this.logger.error(`verifyPasswordResetOtp lookup failed for ${normalized}: ${error.message}`);
      return { success: false, error: 'Verification failed.' };
    }

    if (!user || !user.otp_code) {
      return { success: false, error: 'Invalid OTP code. Please try again.' };
    }

    if (user.otp_code !== otp) {
      return { success: false, error: 'Invalid OTP code. Please try again.' };
    }

    if (!user.otp_expiry || new Date(user.otp_expiry) < new Date()) {
      return { success: false, error: 'OTP has expired. Please request a new one.' };
    }

    const { token } = this.generateResetToken(String(user.id), user.email || normalized);
    return { success: true, token };
  }

  async completePasswordReset(token: string, newPassword: string) {
    let payload: ResetPayload;

    try {
      payload = jwt.verify(token, this.jwtSecret) as ResetPayload;
    } catch {
      return { success: false, error: 'Invalid or expired security token.' };
    }

    if (!this.supabaseAdmin) {
      return { success: false, error: 'Server is missing service-role configuration.' };
    }

    const { data: publicUser, error: lookupError } = await this.supabaseRead
      .from('users')
      .select('auth_id')
      .eq('id', payload.userId)
      .maybeSingle();

    if (lookupError || !publicUser?.auth_id) {
      this.logger.error(
        `Password reset lookup failed for user ${payload.userId}: ${lookupError?.message || 'no auth_id'}`
      );
      return { success: false, error: 'User account is not linked to an authentication record.' };
    }

    const { error: updateError } = await this.supabaseAdmin.auth.admin.updateUserById(
      publicUser.auth_id,
      { password: newPassword }
    );

    if (updateError) {
      this.logger.error(`Password reset failed for user ${payload.userId}: ${updateError.message}`);
      return { success: false, error: 'Failed to update password.' };
    }

    await this.supabaseRead
      .from('users')
      .update({ otp_code: null, otp_expiry: null })
      .eq('id', payload.userId);

    return { success: true };
  }

  // ─── User-management (admin) ──────────────────────────────────────────────
  async createUser(dto: CreateUserDto) {
    if (!this.supabaseAdmin) {
      return { success: false, error: 'Server is missing service-role configuration.' };
    }

    const email = dto.email.trim().toLowerCase();
    const username = email.split('@')[0];
    const fullName = `${dto.first_name} ${dto.last_name}`.trim();
    const tempPassword = 'password123';

    const { data: created, error: createError } =
      await this.supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: fullName,
          role: dto.role,
          status: 'Invited',
        },
      });

    if (createError || !created?.user) {
      this.logger.warn(`createUser failed for ${email}: ${createError?.message}`);
      const message = createError?.message || 'Failed to create authentication user.';
      const conflict = /already.*registered|already.*exists/i.test(message);
      return { success: false, error: conflict ? 'A user with this email already exists.' : message };
    }

    const authUser = created.user;

    const insertPayload: Record<string, unknown> = {
      first_name: dto.first_name,
      last_name: dto.last_name,
      full_name: fullName,
      email,
      username,
      phone: dto.phone || null,
      birthday: dto.birthday || null,
      sex: dto.sex || null,
      role: dto.role,
      status: 'Invited',
      advisory_class: dto.advisory_class || null,
      auth_id: authUser.id,
    };

    const { data: publicRow, error: insertError } = await this.supabaseRead
      .from('users')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError || !publicRow) {
      this.logger.error(
        `createUser: public.users insert failed for ${email}, rolling back auth user: ${insertError?.message}`
      );
      await this.supabaseAdmin.auth.admin.deleteUser(authUser.id).catch((err) => {
        this.logger.error(`Rollback failed for auth user ${authUser.id}: ${err?.message || err}`);
      });
      const code = (insertError as any)?.code;
      const friendly =
        code === '23505'
          ? 'A user with this email or username already exists.'
          : insertError?.message || 'Failed to create user profile.';
      return { success: false, error: friendly };
    }

    await this.supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        name: fullName,
        role: dto.role,
        public_user_id: publicRow.id,
        status: 'Invited',
      },
    });

    if (this.smtpUser && this.smtpPass) {
      await this.sendInviteEmail(email, dto.first_name, username, tempPassword).catch((err) => {
        this.logger.warn(`Invite email failed for ${email}: ${err?.message || err}`);
      });
    }

    return { success: true, data: publicRow };
  }

  async deleteUser(publicUserId: string | number) {
    if (!this.supabaseAdmin) {
      return { success: false, error: 'Server is missing service-role configuration.' };
    }

    const { data: row, error: lookupError } = await this.supabaseRead
      .from('users')
      .select('auth_id')
      .eq('id', publicUserId)
      .maybeSingle();

    if (lookupError) {
      return { success: false, error: lookupError.message };
    }
    if (!row) {
      return { success: false, error: 'User not found.' };
    }

    if (row.auth_id) {
      const { error: authError } = await this.supabaseAdmin.auth.admin.deleteUser(row.auth_id);
      if (authError && !/User not found/i.test(authError.message)) {
        this.logger.error(`Auth delete failed for user ${publicUserId}: ${authError.message}`);
        return { success: false, error: authError.message };
      }
    }

    const { error: deleteError } = await this.supabaseRead
      .from('users')
      .delete()
      .eq('id', publicUserId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  }

  async resetUserPassword(publicUserId: string | number, newPassword?: string) {
    if (!this.supabaseAdmin) {
      return { success: false, error: 'Server is missing service-role configuration.' };
    }

    const { data: row, error: lookupError } = await this.supabaseRead
      .from('users')
      .select('auth_id, email, first_name')
      .eq('id', publicUserId)
      .maybeSingle();

    if (lookupError || !row) {
      return { success: false, error: lookupError?.message || 'User not found.' };
    }
    if (!row.auth_id) {
      return { success: false, error: 'User is not linked to an authentication record.' };
    }

    const password = newPassword || 'password123';

    const { error: updateError } = await this.supabaseAdmin.auth.admin.updateUserById(
      row.auth_id,
      { password }
    );

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, tempPassword: password };
  }

  async forcePasswordChange(dto: ForcePasswordChangeDto) {
    if (!this.supabaseAdmin) {
      return { success: false, error: 'Server is missing service-role configuration.' };
    }

    const email = dto.email.trim().toLowerCase();

    // Look up the user
    const { data: publicUser, error: lookupError } = await this.supabaseRead
      .from('users')
      .select('id, auth_id, status, first_name')
      .ilike('email', email)
      .maybeSingle();

    if (lookupError || !publicUser) {
      return { success: false, error: 'User not found.' };
    }

    // Verify the current password by attempting to sign in (optional but secure)
    // For now, we'll just update the password and change status

    // Update password in auth
    const { error: updateAuthError } = await this.supabaseAdmin.auth.admin.updateUserById(
      publicUser.auth_id,
      { password: dto.newPassword }
    );

    if (updateAuthError) {
      this.logger.error(`Password update failed for ${email}: ${updateAuthError.message}`);
      return { success: false, error: 'Failed to update password.' };
    }

    // Update status from Invited/Pending to Active in public.users
    const { error: updateStatusError } = await this.supabaseRead
      .from('users')
      .update({ status: 'Active' })
      .eq('id', publicUser.id);

    if (updateStatusError) {
      this.logger.error(`Status update failed for ${email}: ${updateStatusError.message}`);
      return { success: false, error: 'Password updated but status change failed.' };
    }

    this.logger.log(`User ${email} successfully changed password and activated account.`);

    await this.supabaseAdmin.auth.admin.updateUserById(publicUser.auth_id, {
      user_metadata: {
        status: 'Active',
      },
    }).catch((err) => {
      this.logger.warn(`Could not update auth metadata status for ${email}: ${err?.message || err}`);
    });

    return { success: true, message: 'Password changed and account activated.' };
  }

  async updateUserEmail(publicUserId: string | number, newEmail: string) {
    if (!this.supabaseAdmin) {
      return { success: false, error: 'Server is missing service-role configuration.' };
    }

    const email = newEmail.trim().toLowerCase();
    const username = email.split('@')[0];

    const { data: row, error: lookupError } = await this.supabaseRead
      .from('users')
      .select('auth_id')
      .eq('id', publicUserId)
      .maybeSingle();

    if (lookupError || !row) {
      return { success: false, error: lookupError?.message || 'User not found.' };
    }
    if (!row.auth_id) {
      return { success: false, error: 'User is not linked to an authentication record.' };
    }

    const { error: authError } = await this.supabaseAdmin.auth.admin.updateUserById(
      row.auth_id,
      { email, email_confirm: true }
    );

    if (authError) {
      const conflict = /already.*registered|already.*been used|duplicate/i.test(authError.message);
      return {
        success: false,
        error: conflict ? 'A user with this email already exists.' : authError.message,
      };
    }

    const { error: updateError } = await this.supabaseRead
      .from('users')
      .update({ email, username })
      .eq('id', publicUserId);

    if (updateError) {
      this.logger.error(
        `updateUserEmail: public.users update failed for ${publicUserId} after auth was changed: ${updateError.message}`
      );
      const code = (updateError as any)?.code;
      const friendly =
        code === '23505'
          ? 'A user with this email or username already exists.'
          : updateError.message;
      return { success: false, error: friendly };
    }

    return { success: true, email, username };
  }

  private generateTempPassword(): string {
    const bytes = require('crypto').randomBytes(12).toString('base64url');
    return `Tmp_${bytes}`;
  }

  async sendOtpEmail(email: string, otp: string) {
    try {
      if (!this.smtpUser || !this.smtpPass) {
        this.logger.error('SMTP credentials are not configured.');
        return { error: 'SMTP is not configured.' };
      }

      const transporter = this.createTransporter();

      await transporter.sendMail({
        from: `${this.smtpFromName} <${this.smtpFromEmail}>`,
        to: email,
        subject: 'Your Password Reset OTP',
        html: `Your OTP code is: <b>${otp}</b>. It expires in 10 minutes.`
      });

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Message could not be sent. Unknown mailer error.';

      this.logger.error(`OTP email failed for ${email}: ${message}`);
      return { error: `Message could not be sent. Mailer Error: ${message}` };
    }
  }

  async sendAttendanceEmail(payload: AttendanceMailPayload) {
    try {
      if (!this.smtpUser || !this.smtpPass) {
        this.logger.error('SMTP credentials are not configured.');
        return { success: false, error: 'SMTP is not configured.' };
      }

      const transporter = this.createTransporter();
      const statusColor = payload.status === 'Late' ? '#dc2626' : '#16a34a';

      await transporter.sendMail({
        from: `${this.smtpFromName} <${this.smtpFromEmail}>`,
        to: payload.parentEmail,
        subject: `School Attendance Update: ${payload.studentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px; color: #333;">
              <h2 style="color: #860108;">Attendance Notification</h2>
              <p>Dear Parent,</p>
              <p>This is to inform you that your child, <strong>${payload.studentName}</strong>, has entered the school premises.</p>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Time In:</strong> ${payload.timeIn}</p>
                  <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${payload.status}</span></p>
              </div>
              <p>Thank you for using E-QRAS.</p>
              <hr style="border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply.</p>
          </div>
        `
      });

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Message could not be sent. Unknown mailer error.';

      this.logger.error(`Attendance email failed for ${payload.parentEmail}: ${message}`);
      return {
        success: false,
        error: `Message could not be sent. Mailer Error: ${message}`
      };
    }
  }

  async sendInviteEmail(email: string, name: string, username: string, passwordStr: string) {
    try {
      if (!this.smtpUser || !this.smtpPass) {
        this.logger.error('SMTP credentials are not configured.');
        return { success: false, error: 'SMTP is not configured.' };
      }

      const transporter = this.createTransporter();

      await transporter.sendMail({
        from: `${this.smtpFromName} <${this.smtpFromEmail}>`,
        to: email,
        subject: `Welcome to E-QRAS, ${name}!`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px; color: #333;">
              <h2 style="color: #860108;">Welcome to E-QRAS!</h2>
              <p>Dear ${name},</p>
              <p>You have been invited to join the Emmaus QR Attendance System (E-QRAS).</p>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                  <p style="margin: 5px 0;"><strong>Password:</strong> ${passwordStr}</p>
              </div>
              <p>Please log in using these credentials. We recommend changing your password after your first login.</p>
              <p>Thank you,<br/>The E-QRAS Team</p>
              <hr style="border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply.</p>
          </div>
        `
      });

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Message could not be sent. Unknown mailer error.';

      this.logger.error(`Invite email failed for ${email}: ${message}`);
      return {
        success: false,
        error: `Message could not be sent. Mailer Error: ${message}`
      };
    }
  }

  private createTransporter(): Transporter {
    return nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass
      },
      tls: {
        rejectUnauthorized: this.smtpRejectUnauthorized
      }
    });
  }
}
