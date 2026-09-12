import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMenuFlowIntegrationDto {
  @IsBoolean()
  menuFlowEnabled: boolean;

  @IsOptional()
  @IsString()
  menuFlowCompanyId?: string;
}
