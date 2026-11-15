import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IInvoiceSchedule, IInvoiceScheduleRun, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import {
	CreateInvoiceScheduleDTO,
	InvoiceScheduleListQueryDTO,
	InvoiceScheduleRunsQueryDTO,
	InvoiceScheduleScopeDTO,
	UpdateInvoiceScheduleDTO
} from './dto/invoice-schedule.dto';
import { InvoiceScheduleService } from './invoice-schedule.service';

/**
 * The billing schedules of an organization's clients. Guarded like the invoices they make: reading them takes
 * `INVOICES_VIEW`, changing them `INVOICES_EDIT`. Every route names the organization it acts in, which the caller must
 * belong to.
 */
@ApiTags('InvoiceSchedule')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INVOICES_EDIT)
@Controller('/invoice-schedules')
export class InvoiceScheduleController {
	constructor(private readonly invoiceScheduleService: InvoiceScheduleService) {}

	@ApiOperation({ summary: 'The billing schedules of an organization, or of one of its clients' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Each with its next period and its latest run.' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('/')
	@UseValidationPipe({ whitelist: true, transform: true })
	async list(@Query() query: InvoiceScheduleListQueryDTO): Promise<IInvoiceSchedule[]> {
		return await this.invoiceScheduleService.list(query);
	}

	@ApiOperation({ summary: 'One billing schedule, with its next period and its latest run' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a schedule of the organization' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('/:id')
	@UseValidationPipe({ whitelist: true, transform: true })
	async findOne(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: InvoiceScheduleScopeDTO
	): Promise<IInvoiceSchedule> {
		return await this.invoiceScheduleService.findOneInOrganization(id, query.organizationId);
	}

	@ApiOperation({ summary: "A billing schedule's latest runs, newest first, with the invoices they made" })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a schedule of the organization' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('/:id/runs')
	@UseValidationPipe({ whitelist: true, transform: true })
	async runs(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: InvoiceScheduleRunsQueryDTO
	): Promise<IInvoiceScheduleRun[]> {
		return await this.invoiceScheduleService.runsOf(id, query.organizationId, query.take);
	}

	@ApiOperation({ summary: "Set a client's billing schedule" })
	@ApiResponse({ status: HttpStatus.CREATED })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: "Invalid input, a start day that does not exist, or a client that is not the organization's"
	})
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The client already has a schedule' })
	@Post('/')
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ whitelist: true, transform: true })
	async create(@Body() input: CreateInvoiceScheduleDTO): Promise<IInvoiceSchedule> {
		return await this.invoiceScheduleService.createSchedule(input);
	}

	@ApiOperation({ summary: 'Change a billing schedule, pause it or resume it' })
	@ApiResponse({ status: HttpStatus.OK })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a schedule of the organization' })
	@Put('/:id')
	@UseValidationPipe({ whitelist: true, transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateInvoiceScheduleDTO
	): Promise<IInvoiceSchedule> {
		return await this.invoiceScheduleService.updateSchedule(id, input);
	}

	@ApiOperation({ summary: 'Delete a billing schedule and its runs; the invoices it made stay' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not a schedule of the organization' })
	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@UseValidationPipe({ whitelist: true, transform: true })
	async delete(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InvoiceScheduleScopeDTO): Promise<void> {
		await this.invoiceScheduleService.deleteSchedule(id, query.organizationId);
	}
}
