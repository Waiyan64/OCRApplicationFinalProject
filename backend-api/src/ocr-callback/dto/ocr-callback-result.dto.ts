import {
    IsBoolean,
    IsIn,
    IsInt,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FieldPredictionDto {
    @IsOptional()
    @IsString()
    value?: string | null;

    @IsNumber()
    @Min(0)
    @Max(1)
    confidence!: number;

    @IsOptional()
    @IsString()
    source_text?: string | null;
}

export class ParsedTransactionFieldsDto {
    @ValidateNested()
    @Type(() => FieldPredictionDto)
    amount!: FieldPredictionDto;

    @ValidateNested()
    @Type(() => FieldPredictionDto)
    tx_id!: FieldPredictionDto;

    @ValidateNested()
    @Type(() => FieldPredictionDto)
    tx_type!: FieldPredictionDto;

    @ValidateNested()
    @Type(() => FieldPredictionDto)
    timestamp!: FieldPredictionDto;

    @ValidateNested()
    @Type(() => FieldPredictionDto)
    fee!: FieldPredictionDto;

    @ValidateNested()
    @Type(() => FieldPredictionDto)
    balance!: FieldPredictionDto;
}

export class CallbackDeliveryDto {
    @IsOptional()
    @IsBoolean()
    attempted?: boolean;

    @IsOptional()
    @IsString()
    callback_url?: string | null;

    @IsOptional()
    @IsInt()
    status_code?: number | null;

    @IsOptional()
    @IsBoolean()
    ok?: boolean;

    @IsOptional()
    @IsString()
    error?: string | null;

    @IsOptional()
    @IsString()
    response_excerpt?: string | null;
}

export class OcrCallbackResultDto {
    @IsString()
    job_id!: string;

    @IsIn(['processed', 'failed'])
    status!: 'processed' | 'failed';

    @IsString()
    wallet_app_type!: string;

    @ValidateNested()
    @Type(() => ParsedTransactionFieldsDto)
    fields!: ParsedTransactionFieldsDto;

    @IsOptional()
    @IsString()
    raw_text?: string;

    @IsOptional()
    @IsObject()
    diagnostics?: Record<string, unknown>;

    @IsOptional()
    @ValidateNested()
    @Type(() => CallbackDeliveryDto)
    callback?: CallbackDeliveryDto;

    @IsInt()
    processing_ms!: number;

    @IsOptional()
    @IsString()
    processed_at?: string;

    @IsOptional()
    @IsString()
    error?: string | null;
}
