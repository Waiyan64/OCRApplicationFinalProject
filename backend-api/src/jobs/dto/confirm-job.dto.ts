import { IsInt, Max, Min } from 'class-validator';

export class ConfirmJobDto {
    @IsInt()
    @Min(1)
    @Max(1_000_000_000)
    amount!: number;
}