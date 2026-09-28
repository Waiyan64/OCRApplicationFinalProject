import { Module } from '@nestjs/common';
import { OcrGatewayController } from './ocr-gateway.controller';
import { OcrGatewayService } from './ocr-gateway.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
    imports: [JobsModule],
    controllers: [OcrGatewayController],
    providers: [OcrGatewayService],
})
export class OcrGatewayModule { }
