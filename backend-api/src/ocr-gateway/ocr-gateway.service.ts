import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProcessUploadDto } from './dto/process-upload.dto';
import { JobsService } from '../jobs/jobs.service';

type UploadedImage = {
    buffer: Buffer;
    originalname?: string;
    mimetype?: string;
    size?: number;
};

@Injectable()
export class OcrGatewayService {
    private readonly logger = new Logger(OcrGatewayService.name);

    constructor(private readonly jobsService: JobsService) { }

    async processUpload(userId: number, file: UploadedImage | undefined, body: ProcessUploadDto) {
        if (!file || !file.buffer || file.buffer.length === 0) {
            throw new BadRequestException('Image file is required. Use multipart field name "image".');
        }

        const maxImageBytes = Number(process.env.OCR_MAX_IMAGE_BYTES ?? 10_000_000);
        if (file.buffer.length > maxImageBytes) {
            throw new BadRequestException(`Image exceeds max size (${maxImageBytes} bytes).`);
        }

        const mime = file.mimetype ?? 'application/octet-stream';
        if (!mime.startsWith('image/')) {
            throw new BadRequestException(`Unsupported file type: ${mime}`);
        }

        const ocrBase = (process.env.OCR_SERVICE_BASE_URL ?? '').trim();
        if (!ocrBase) {
            throw new InternalServerErrorException('OCR_SERVICE_BASE_URL is not configured in backend-api environment.');
        }

        const form = new FormData();
        const jobId = body.job_id ?? randomUUID();

        await this.jobsService.createJob({
            jobId,
            userId,
            walletApp: body.wallet_app_type,
            txType: body.tx_type,
        });

        form.append('job_id', jobId);
        form.append('wallet_app_type', body.wallet_app_type);
        form.append('tx_type', body.tx_type);

        if (body.metadata_json) {
            form.append('metadata_json', body.metadata_json);
        } else {
            const fallbackMetadata = {
                source: 'backend-api',
                tx_type: body.tx_type,
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            };
            form.append('metadata_json', JSON.stringify(fallbackMetadata));
        }

        const filename = file.originalname || `${jobId}.bin`;
        const binary = new Uint8Array(file.buffer);
        form.append('image', new Blob([binary], { type: mime }), filename);

        const timeoutMs = Number(process.env.OCR_REQUEST_TIMEOUT_MS ?? 45000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const endpoint = `${ocrBase.replace(/\/$/, '')}/v1/jobs/process-upload`;

        try {
            const serviceToken = (process.env.OCR_SERVICE_AUTH_TOKEN ?? '').trim();
            const response = await fetch(endpoint, {
                method: 'POST',
                body: form,
                headers: serviceToken
                    ? { 'x-ocr-service-token': serviceToken }
                    : undefined,
                signal: controller.signal,
            });

            const text = await response.text();
            let payload: unknown = text;
            try {
                payload = text ? JSON.parse(text) : {};
            } catch {
                // keep text payload for debug on parse errors
            }

            if (!response.ok) {
                this.logger.warn(
                    `OCR service responded with ${response.status}. endpoint=${endpoint}`,
                );
                throw new BadGatewayException({
                    message: 'OCR service rejected request.',
                    statusCode: response.status,
                    ocrResponse: payload,
                });
            }

            return payload;
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                throw new BadGatewayException('OCR request timed out.');
            }
            if (error instanceof BadGatewayException) {
                throw error;
            }
            throw new BadGatewayException(`Failed to reach OCR service: ${(error as Error).message}`);
        } finally {
            clearTimeout(timer);
        }
    }

}
