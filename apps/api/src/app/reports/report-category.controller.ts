import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination, PaginationParams } from '../core';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { ReportCategory } from './report-category.entity';
import { ReportCategoryService } from './report-category.service';

@ApiTags('Report Category')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('category')
export class ReportCategoryController extends CrudController<ReportCategory> {
	constructor(private reportCategoryService: ReportCategoryService) {
		super(reportCategoryService);
	}

	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	async findAll(
		@Query() filter?: PaginationParams<ReportCategory>
	): Promise<IPagination<ReportCategory>> {
		return this.reportCategoryService.findAll(filter);
	}
}
