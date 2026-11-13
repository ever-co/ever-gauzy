import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, ISavedReport, ISavedReportShareResponse, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { EmployeeTrackedDataGuard, PermissionGuard, TenantBaseGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import {
	CreateSavedReportDTO,
	SavedReportListQueryDTO,
	ShareSavedReportDTO,
	UpdateSavedReportDTO
} from './dto/saved-report.dto';
import { SavedReportService } from './saved-report.service';

/**
 * A member's saved reports. Guarded like the time log reports they describe (`/timesheet/time-log/report/*`): the
 * tenant, one of the permissions those reports are read with, and the organization's rule on seeing tracked data. Every
 * route acts on the caller's own reports only.
 */
@ApiTags('SavedReport')
@UseGuards(TenantBaseGuard, PermissionGuard, EmployeeTrackedDataGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
@Controller('/saved-reports')
export class SavedReportController {
	constructor(private readonly savedReportService: SavedReportService) {}

	@ApiOperation({ summary: "List the caller's saved reports of an organization, newest first" })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/')
	@UseValidationPipe({ whitelist: true, transform: true })
	async list(@Query() query: SavedReportListQueryDTO): Promise<IPagination<ISavedReport>> {
		return await this.savedReportService.listOwn(query.organizationId);
	}

	@ApiOperation({ summary: "Read one of the caller's saved reports" })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a report of the caller' })
	@Get('/:id')
	async findOne(@Param('id', UUIDValidationPipe) id: ID): Promise<ISavedReport> {
		return await this.savedReportService.findOwn(id);
	}

	@ApiOperation({ summary: 'Save a report: its name, period, filters and grouping' })
	@ApiResponse({ status: HttpStatus.CREATED })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, or a period that is not a rule nor two days'
	})
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ whitelist: true, transform: true })
	async create(@Body() input: CreateSavedReportDTO): Promise<ISavedReport> {
		return await this.savedReportService.createOwn(input);
	}

	@ApiOperation({ summary: "Change one of the caller's saved reports" })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a report of the caller' })
	@Put('/:id')
	@UseValidationPipe({ whitelist: true, transform: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() input: UpdateSavedReportDTO): Promise<ISavedReport> {
		return await this.savedReportService.updateOwn(id, input);
	}

	@ApiOperation({ summary: "Delete one of the caller's saved reports, and its link" })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a report of the caller' })
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.savedReportService.deleteOwn(id);
	}

	@ApiOperation({
		summary: 'Turn a read-only link on for a saved report, or replace it (returns the token once)'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description:
			'The token the link carries, this one time: only its digest is stored. A previous link stops working.'
	})
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a report of the caller' })
	@Post('/:id/share')
	@HttpCode(HttpStatus.CREATED)
	@Header('Cache-Control', 'no-store')
	@Header('Pragma', 'no-cache')
	@UseValidationPipe({ whitelist: true, transform: true })
	async share(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ShareSavedReportDTO
	): Promise<ISavedReportShareResponse> {
		return await this.savedReportService.shareOwn(id, input);
	}

	@ApiOperation({ summary: 'Turn the link of a saved report off: it stops working at once' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a report of the caller' })
	@Delete('/:id/share')
	@HttpCode(HttpStatus.NO_CONTENT)
	async unshare(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.savedReportService.unshareOwn(id);
	}
}
