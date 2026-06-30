import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCityDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  state?: string;

  @IsString()
  @IsOptional()
  clientWhatsappMessage?: string;
<<<<<<< HEAD

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
=======
}
>>>>>>> parent of 613ac8c (atualização front)
