import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { OcrCallbackController } from './ocr-callback.controller';
import { OcrCallbackAuthService } from './ocr-callback-auth.service';
import { OcrCallbackService } from './ocr-callback.service';

@Module({
    imports: [
        JobsModule,
    ],
    controllers: [OcrCallbackController],
    providers: [OcrCallbackAuthService, OcrCallbackService],
    exports: [OcrCallbackService],
})
export class OcrCallbackModule { }
