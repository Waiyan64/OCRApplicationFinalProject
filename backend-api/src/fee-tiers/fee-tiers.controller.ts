import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
    Req,
} from '@nestjs/common';
import { FeeTiersService } from './fee-tiers.service';
import { CreateFeeTierDto, UpdateFeeTierDto } from './dto/fee-tier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('fee-tiers')
export class FeeTiersController {
    constructor(private readonly service: FeeTiersService) {}

    @Get()
    findAll(@Req() req: any) {
        return this.service.findAll(req.user.id);
    }

    @Post()
    create(@Req() req: any, @Body() dto: CreateFeeTierDto) {
        return this.service.create(req.user.id, dto);
    }

    @Patch(':id')
    update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFeeTierDto) {
        return this.service.update(req.user.id, id, dto);
    }

    @Delete(':id')
    remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.service.remove(req.user.id, id);
    }
}
