import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { BaseQueryDTO } from './../core/crud';
import { ReportCategory } from './report-category.entity';
import { ReportCategoryService } from './report-category.service';

@ApiTags('Report Category')
@Controller('/report/category')
export class ReportCategoryController {
	constructor(private reportCategoryService: ReportCategoryService) {}

	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get('/')
	async findAll(@Query() filter?: BaseQueryDTO<ReportCategory>): Promise<IPagination<ReportCategory>> {
		return this.reportCategoryService.findAll(filter);
	}
}
