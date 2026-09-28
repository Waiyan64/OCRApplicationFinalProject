import { Injectable } from '@nestjs/common';
import { OcrCallbackResultDto } from './dto/ocr-callback-result.dto';
import { OcrAuthMethod } from './ocr-callback-auth.service';
import { JobsService } from '../jobs/jobs.service';

export interface PersistedOcrRecord {
    jobId: string;
    authMethod: OcrAuthMethod;
    receivedAt: string;
    payload: OcrCallbackResultDto;
    requestMeta: {
        timestampHeader?: string;
        signaturePresent: boolean;
        userAgent?: string;
    };
}

@Injectable()
export class OcrCallbackService {
    constructor(
        private readonly jobsService: JobsService,
    ) { }

    async save(
        payload: OcrCallbackResultDto,
        authMethod: OcrAuthMethod,
        requestMeta: PersistedOcrRecord['requestMeta'],
    ): Promise<PersistedOcrRecord> {
        const record: PersistedOcrRecord = {
            jobId: payload.job_id,
            authMethod,
            receivedAt: new Date().toISOString(),
            payload,
            requestMeta,
        };

        const status = payload.status === 'processed' ? 'awaiting_confirmation' : 'failed';
        await this.jobsService.updateJobResult(
            payload.job_id,
            status,
            payload as unknown as Record<string, unknown>,
        );

        return record;
    }

    async getByJobId(jobId: string, userId: number): Promise<PersistedOcrRecord | undefined> {
        try {
            const job = await this.jobsService.findByJobId(jobId, userId);
            if (!job.result) return undefined;
            return {
                jobId: job.jobId,
                authMethod: 'none',
                receivedAt: job.updatedAt.toISOString(),
                payload: job.result as unknown as OcrCallbackResultDto,
                requestMeta: { signaturePresent: false },
            };
        } catch {
            return undefined;
        }
    }

    async getDiagnostics() {
        return { message: 'Diagnostics now served from ocr_jobs table via JobsService.' };
    }
}
