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
  @MinLength(20)
  @MaxLength(255)
  @Matches(/^\$2[aby]\$.+/, { message: 'Password must be a bcrypt hash.' })
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
