import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	GetReportMenuItemsInput,
	IPagination,
	UpdateReportMenuInput,
} from '@gauzy/contracts';
import { Report } from './report.entity';
import { ReportService } from './report.service';
import { ReportOrganizationService } from './report-organization.service';

@ApiTags('Report')
@Controller()
export class ReportController {

	constructor(
		private readonly _reportService: ReportService,
		private readonly _reportOrganizationService: ReportOrganizationService,
	) { }

	/**
	 * Get all reports
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records',
	})
	@Get()
	async findAllMenus(
		@Query() options: GetReportMenuItemsInput
	): Promise<IPagination<Report>> {
		return await this._reportService.findAllMenus(options);
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records',
	})
	@Get('menu-items')
	async getMenuItems(
		@Query() filter?: GetReportMenuItemsInput
	): Promise<Report[]> {
		return await this._reportService.getMenuItems(filter);
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records',
	})
	@Post('menu-item')
	async updateReportMenu(@Body() input?: UpdateReportMenuInput) {
		return await this._reportOrganizationService.updateReportMenu(input);
	}
}
