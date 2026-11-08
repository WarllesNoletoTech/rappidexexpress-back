import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateCityDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  state?: string;

  @IsString()
  @IsOptional()
  clientWhatsappMessage?: string;

  @IsIn(['fixed', 'neighborhood'])
  @IsOptional()
  feeMode?: 'fixed' | 'neighborhood';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  @IsOptional()
  platformServiceFee?: number;

  @IsString()
  @IsOptional()
  deliveryValue?: string;

  @IsNumber()
  @IsOptional()
  deliveryFeeValue?: number;

  @IsNumber()
  @IsOptional()
  monthlyFeeValue?: number;

  @IsString()
  @IsOptional()
  pixKey?: string;

  @IsString()
  @IsOptional()
  adminWhatsapp?: string;

  @IsString()
  @IsOptional()
  whatsappPhoneNumberId?: string;

  @IsString()
  @IsOptional()
  whatsappCloudToken?: string;
}
