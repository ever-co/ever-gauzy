import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination, PaginationParams } from '../core';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { Report } from './report.entity';
import { ReportService } from './report.service';

@ApiTags('Report')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ReportController extends CrudController<Report> {
	constructor(private reportService: ReportService) {
		super(reportService);
	}

	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	async findAll(
		@Query() filter?: PaginationParams<Report>
	): Promise<IPagination<Report>> {
		return this.reportService.findAll(filter);
	}
}
