import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProcessUploadDto } from './dto/process-upload.dto';
import { OcrGatewayService } from './ocr-gateway.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('v1/ocr')
export class OcrGatewayController {
    constructor(private readonly ocrGatewayService: OcrGatewayService) { }

    @Post('process-upload')
    @HttpCode(HttpStatus.ACCEPTED)
    @UseInterceptors(FileInterceptor('image', {
        limits: {
            fileSize: Number(process.env.OCR_MAX_IMAGE_BYTES ?? 10_000_000),
            files: 1,
        },
    }))
    async processUpload(
        @Req() req: any,
        @UploadedFile() file: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number },
        @Body() body: ProcessUploadDto,
    ) {
        return this.ocrGatewayService.processUpload(req.user.id, file, body);
    }
}
