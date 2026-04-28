import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiService } from './api.service';
import {
  CompleteResetDto,
  GenerateTokenDto,
  StudentsQueryDto,
  SendAttendanceDto,
  SendOtpDto,
  SendInviteDto
} from './api.dto';

@Controller('api')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('students')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async getStudents(@Query() query: StudentsQueryDto) {
    return this.apiService.getStudents(query);
  }

  @Get('students/summary')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async getStudentsSummary() {
    return this.apiService.getStudentsSummary();
  }

  @Post(['generate_token.php', 'generate-token'])
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  generateToken(@Body() body: GenerateTokenDto) {
    return this.apiService.generateResetToken(body.userId, body.email);
  }

  @Post(['complete_reset.php', 'complete-reset'])
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async completeReset(@Body() body: CompleteResetDto) {
    return this.apiService.completePasswordReset(body.token, body.newPassword);
  }

  @Post(['send_otp.php', 'send-otp'])
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  async sendOtp(@Body() body: SendOtpDto) {
    return this.apiService.sendOtpEmail(body.email, body.otp);
  }

  @Post(['send_attendance_email.php', 'send-attendance-email'])
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async sendAttendanceEmail(@Body() body: SendAttendanceDto) {
    return this.apiService.sendAttendanceEmail({
      parentEmail: body.parent_email,
      studentName: body.student_name,
      status: body.status,
      timeIn: body.time_in
    });
  }

  @Post(['send_invite_email.php', 'send-invite-email'])
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async sendInviteEmail(@Body() body: SendInviteDto) {
    return this.apiService.sendInviteEmail(
      body.email,
      body.name,
      body.username,
      body.password
    );
  }
}
