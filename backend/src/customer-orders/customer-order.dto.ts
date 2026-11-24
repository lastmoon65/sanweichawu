import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CustomerCreateOrderItemDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(500)
  remark?: string | null;
}

export class CustomerCreateOrderDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  sessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerCreateOrderItemDto)
  items!: CustomerCreateOrderItemDto[];
}

export class CustomerCancelOrderDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(500)
  cancelReason?: string | null;
}
