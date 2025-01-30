import { IsString, IsInt, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class BusinessHoursDto {
  @IsString()
  start: string;

  @IsString()
  end: string;
}

class PhoneFormatDto {
  @IsInt()
  @Min(1)
  @Max(15)
  minDigits: number;

  @IsInt()
  @Min(1)
  @Max(15)
  maxDigits: number;
}

export class UpdateConfigDto {
  @IsString()
  businessType: string;

  @IsString()
  businessName: string;

  @IsString()
  businessSummary: string;

  @IsObject()
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  businessHours: BusinessHoursDto;

  @IsString()
  serviceDuration: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PhoneFormatDto)
  phoneFormat: PhoneFormatDto;

  @IsInt()
  @Min(1)
  @Max(12)
  advanceBookingMonths: number;
}
