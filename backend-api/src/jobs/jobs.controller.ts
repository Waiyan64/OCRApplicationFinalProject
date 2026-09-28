import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ConfirmJobDto } from './dto/confirm-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
    constructor(private readonly service: JobsService) { }

    @Get('pending-review')
    pendingReviews(@Req() req: { user: { id: number } }) {
        return this.service.findPendingReviews(req.user.id);
    }

    @Get(':jobId')
    findOne(@Param('jobId') jobId: string, @Req() req: { user: { id: number } }) {
        return this.service.findByJobId(jobId, req.user.id);
    }

    @Post(':jobId/confirm')
    confirm(
        @Param('jobId') jobId: string,
        @Req() req: { user: { id: number } },
        @Body() body: ConfirmJobDto,
    ) {
        return this.service.confirmJob(jobId, req.user.id, body);
    }

    @Post(':jobId/reject')
    reject(@Param('jobId') jobId: string, @Req() req: { user: { id: number } }) {
        return this.service.rejectJob(jobId, req.user.id);
    }
}
