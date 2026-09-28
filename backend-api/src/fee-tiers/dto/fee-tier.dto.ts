import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeeTierDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAmount!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxAmount!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    fee!: number;
}

export class UpdateFeeTierDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAmount?: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxAmount?: number;

    @Type(() => Number)
    @IsNumber()
    @Min(0)
    fee?: number;
}
