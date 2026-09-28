import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('stats')
    getStats() {
        return this.adminService.getStats();
    }

    @Get('users')
    getUsers(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.adminService.getUsers(
            page ? Number(page) : 1,
            limit ? Number(limit) : 20
        );
    }

    @Patch('users/:id')
    updateUser(
        @Param('id') id: string,
        @Body() updateDto: { role?: 'free' | 'subscribed' | 'admin', premiumExpiresAt?: string | null }
    ) {
        const payload: any = { ...updateDto };
        if (updateDto.premiumExpiresAt !== undefined) {
            payload.premiumExpiresAt = updateDto.premiumExpiresAt ? new Date(updateDto.premiumExpiresAt) : null;
        }
        return this.adminService.updateUser(Number(id), payload);
    }

    @Get('jobs')
    getJobs(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
    ) {
        return this.adminService.getJobs(
            page ? Number(page) : 1,
            limit ? Number(limit) : 20,
            status
        );
    }

    @Get('transactions')
    getTransactions(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.adminService.getTransactions(
            page ? Number(page) : 1,
            limit ? Number(limit) : 20
        );
    }
}
