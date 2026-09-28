import {
    Body,
    Controller,
    Get,
    Headers,
    NotFoundException,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { OcrCallbackResultDto } from './dto/ocr-callback-result.dto';
import { OcrCallbackAuthService } from './ocr-callback-auth.service';
import { OcrCallbackService } from './ocr-callback.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('internal/ocr/callback')
export class OcrCallbackController {
    constructor(
        private readonly authService: OcrCallbackAuthService,
        private readonly callbackService: OcrCallbackService,
    ) { }

    @Post()
    async receiveCallback(
        @Req() req: { rawBody?: Buffer; headers: IncomingHttpHeaders },
        @Body() payload: OcrCallbackResultDto,
        @Headers('x-ocr-timestamp') timestampHeader?: string,
        @Headers('x-ocr-signature') signatureHeader?: string,
        @Headers('user-agent') userAgent?: string,
    ) {
        const rawBody =
            req.rawBody && Buffer.isBuffer(req.rawBody)
                ? req.rawBody
                : Buffer.from(JSON.stringify(payload), 'utf-8');

        const authMethod = this.authService.verifyRequest(rawBody, req.headers);

        const saved = await this.callbackService.save(payload, authMethod, {
            timestampHeader,
            signaturePresent: Boolean(signatureHeader),
            userAgent,
        });

        return {
            received: true,
            jobId: saved.jobId,
            status: payload.status,
            authMethod: saved.authMethod,
            storedAt: saved.receivedAt,
        };
    }

    @Get('diagnostics/summary')
    diagnostics() {
        return this.callbackService.getDiagnostics();
    }

    @Get(':jobId')
    @UseGuards(JwtAuthGuard)
    async getByJobId(@Param('jobId') jobId: string, @Req() req: { user: { id: number } }) {
        const record = await this.callbackService.getByJobId(jobId, req.user.id);
        if (!record) {
            throw new NotFoundException('OCR callback record not found.');
        }
        return record;
    }
}
