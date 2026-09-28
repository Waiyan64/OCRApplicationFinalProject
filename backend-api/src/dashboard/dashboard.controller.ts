import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('profile')
    getProfile(@Req() req: any) {
        return this.dashboardService.getProfile(req.user.id);
    }

    @Get('summary')
    getSummary(@Req() req: any) {
        return this.dashboardService.getSummary(req.user.id);
    }

    @Get('transactions/recent')
    getRecentTransactions(@Req() req: any) {
        return this.dashboardService.getRecentTransactions(req.user.id);
    }
}
