import {
	GetReportMenuItemsInput,
	IGetReport,
	IPagination,
	UpdateReportMenuInput
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Post,
	Query
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Report } from './report.entity';
import { ReportService } from './report.service';

@ApiTags('Report')
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
	async getAll(@Query() filter?: IGetReport): Promise<IPagination<Report>> {
		return this.reportService.findAll(filter);
	}

	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get('menu-items')
	async getMenuItems(
		@Query() filter?: GetReportMenuItemsInput
	): Promise<Report[]> {
		return this.reportService.getMenuItems(filter);
	}

	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Post('menu-item')
	async updateReportMenu(@Body() input?: UpdateReportMenuInput) {
		return this.reportService.updateReportMenu(input);
	}
}
