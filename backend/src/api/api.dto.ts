import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Existing DTOs ────────────────────────────────────────────────────────────

export class GenerateTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId!: string;

  @IsEmail()
  email!: string;
}

export class CompleteResetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class SendOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
}

export class SendAttendanceDto {
  @IsEmail()
  parent_email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  student_name!: string;

  @IsString()
  @IsIn(['Present', 'Late', 'Absent'])
  status!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  time_in!: string;
}

export class SendInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  password!: string;
}

export class StudentsQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

// ─── Attendance DTOs ──────────────────────────────────────────────────────────

export class ScanAttendanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  student_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class AttendanceQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD.' })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  student_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Present', 'Late', 'Absent'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  section?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}

export class AttendanceReportQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'start_date must be YYYY-MM-DD.' })
  start_date!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'end_date must be YYYY-MM-DD.' })
  end_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  student_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  section?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Present', 'Late', 'Absent'])
  status?: string;
}

export class NotifyAbsenteesDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD.' })
  date?: string;
}

// ─── Students CRUD DTOs ───────────────────────────────────────────────────────

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  student_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  last_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  grade_level!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  section!: string;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  status?: string = 'Active';

  @IsOptional()
  @IsEmail()
  parent_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact_number?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade_level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  status?: string;

  @IsOptional()
  @IsEmail()
  parent_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact_number?: string;
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(128)
  password!: string;
}

// ─── User-management DTOs ─────────────────────────────────────────────────────

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  last_name!: string;

  @IsString()
  @IsIn(['admin', 'teacher', 'guard'])
  role!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthday must be YYYY-MM-DD.' })
  birthday?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  advisory_class?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword?: string;
}

export class UpdateUserEmailDto {
  @IsEmail()
  email!: string;
}

// ─── Pre-login auth DTOs ──────────────────────────────────────────────────────

export class LookupEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier!: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
}
