import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetReportMenuItemsInput, IPagination, RolesEnum, UpdateReportMenuInput } from '@gauzy/contracts';
import { Roles } from '../shared/decorators';
import { RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { CreateReportDTO } from './dto';
import { Report } from './report.entity';
import { ReportService } from './report.service';
import { ReportOrganizationService } from './report-organization.service';

@ApiTags('Report')
@Controller('/report')
export class ReportController {
	constructor(
		private readonly _reportService: ReportService,
		private readonly _reportOrganizationService: ReportOrganizationService
	) {}

	/**
	 * Get all reports
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get('/')
	async findAllReports(@Query() options: GetReportMenuItemsInput): Promise<IPagination<Report>> {
		return await this._reportService.findAllReports(options);
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get('/menu-items')
	async getMenuItems(@Query() filter?: GetReportMenuItemsInput): Promise<Report[]> {
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
		description: 'Found records'
	})
	@Post('/menu-item')
	async updateReportMenu(@Body() input?: UpdateReportMenuInput) {
		return await this._reportOrganizationService.updateReportMenu(input);
	}

	/**
	 * Files one report into the platform-wide catalogue.
	 *
	 * The catalogue has no tenant — an entry here is offered to every tenant's menu, where each organization
	 * still switches it on for itself — so the route is gated to `SUPER_ADMIN` by role, under the tenant
	 * guard that checks the credential's tenant first. The slug must be free and the category live.
	 */
	@ApiOperation({ summary: 'Create a report in the catalogue (SUPER_ADMIN).' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The report.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such category.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The slug is taken.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller is not a SUPER_ADMIN.' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() input: CreateReportDTO): Promise<Report> {
		return await this._reportService.createReport(input);
	}
}
