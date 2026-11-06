import { Equals, IsString, MaxLength, MinLength } from 'class-validator';

/** Comprovação externa registrada pelo SUPERADMIN; não é um evento verificado da API. */
export class ManualIfoodReconciliationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  ifoodDisplayId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  evidenceReference: string;

  @IsString()
  @MinLength(20)
  @MaxLength(500)
  evidenceDescription: string;

  @Equals(true)
  confirmedConcludedOnIfood: true;
}
