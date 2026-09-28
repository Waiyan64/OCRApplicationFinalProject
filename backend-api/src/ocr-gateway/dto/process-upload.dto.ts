import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ProcessUploadDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    job_id?: string;

    @IsString()
    @MinLength(1)
    @MaxLength(64)
    wallet_app_type!: string;

    @IsIn(['cash_in', 'cash_out'])
    tx_type!: 'cash_in' | 'cash_out';

    @IsOptional()
    @IsString()
    metadata_json?: string;
}
