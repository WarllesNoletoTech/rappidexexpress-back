import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class MenuFlowAddonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsInt()
  @Min(0)
  priceCents: number;
}

class MenuFlowItemDto {
  @IsString()
  productName: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(0)
  unitPriceCents: number;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuFlowAddonDto)
  addons?: MenuFlowAddonDto[];
}

export class MenuFlowDeliveryDto {
  @IsString()
  orderId: string;

  @IsString()
  orderNumber: string;

  @IsString()
  restaurantId: string;

  @IsOptional()
  @IsString()
  restaurantName?: string;

  @IsString()
  customerName: string;

  @IsString()
  customerPhone: string;

  @IsObject()
  address: Record<string, string>;

  @IsInt()
  @Min(0)
  subtotalCents: number;

  @IsInt()
  @Min(0)
  deliveryFeeCents: number;

  @IsInt()
  @Min(0)
  customerServiceFeeCents: number;

  @IsInt()
  @Min(0)
  discountCents: number;

  @IsInt()
  @Min(0)
  totalCents: number;

  @IsIn(['PIX', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD'])
  paymentMethod: string;

  @IsOptional()
  @IsBoolean()
  needsChange?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  changeForCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedChangeCents?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuFlowItemDto)
  items: MenuFlowItemDto[];

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}
