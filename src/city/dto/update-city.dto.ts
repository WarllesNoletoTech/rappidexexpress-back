import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> parent of 5803b8a (revert)

  @IsString()
  @IsOptional()
  deliveryValue?: string;

  @IsNumber()
  @IsOptional()
  deliveryFeeValue?: number;

<<<<<<< HEAD
  @IsNumber()
  @IsOptional()
  monthlyFeeValue?: number;

=======
>>>>>>> parent of 5803b8a (revert)
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
<<<<<<< HEAD
=======
}
>>>>>>> parent of 613ac8c (atualização front)
=======
>>>>>>> parent of 5803b8a (revert)
