import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
    constructor(private readonly service: TransactionsService) {}

    @Get()
    findAll(
        @Req() req: any,
        @Query('type') type?: 'cash_in' | 'cash_out',
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
    ) {
        return this.service.findAll(req.user.id, {
            type,
            page:  page  ? Number(page)  : undefined,
            limit: limit ? Number(limit) : undefined,
            fromDate,
            toDate,
        });
    }
}
