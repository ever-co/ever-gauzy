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
import { DeleteResult } from 'typeorm';
import {
	ID,
	IPagination,
	IPayrollItem,
	IPayrollRun,
	IPayrollStatistics,
	IPayrollSummary,
	PermissionsEnum
} from '@gauzy/contracts';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreatePayrollItemDTO, CreatePayrollRunDTO, PayrollRunQueryDTO, UpdatePayrollRunDTO } from './dto';
import { PayrollRunService } from './payroll-run.service';

/**
 * Payroll runs and their line items (issue #2453).
 *
 * Reading needs `ORG_PAYROLL_VIEW`, editing needs `ORG_PAYROLL_EDIT`, and approving or paying a
 * run needs the separate `ORG_PAYROLL_APPROVE` — the person who prepares a payroll run should not
 * be able to approve their own work unaided.
 */
@ApiTags('PayrollRun')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
@Controller('/payroll-run')
export class PayrollRunController {
	constructor(private readonly payrollRunService: PayrollRunService) {}

	/**
	 * Totals across every paid payroll run of an organization, grouped by currency.
	 *
	 * @param organizationId the organization to report on
	 * @returns one set of totals per currency
	 */
	@ApiOperation({ summary: 'Get payroll statistics' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Payroll statistics retrieved' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	@Get('/statistics')
	async getStatistics(
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollStatistics[]> {
		return this.payrollRunService.getStatistics(organizationId);
	}

	/**
	 * List payroll runs, newest pay period first.
	 *
	 * @param options status, frequency, period range and pagination
	 * @returns the matching runs
	 */
	@ApiOperation({ summary: 'Find payroll runs' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found payroll runs' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() options: PayrollRunQueryDTO): Promise<IPagination<IPayrollRun>> {
		return this.payrollRunService.findAllRuns(options);
	}

	/**
	 * Read one payroll run with its line items.
	 *
	 * @param id the run to read
	 * @param organizationId the organization the run belongs to
	 * @returns the run
	 */
	@ApiOperation({ summary: 'Find a payroll run by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found the payroll run' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollRun> {
		return this.payrollRunService.findOneRun(id, organizationId);
	}

	/**
	 * Break a run down into what each employee earns, is deducted and takes home.
	 *
	 * @param id the run to summarize
	 * @param organizationId the organization the run belongs to
	 * @returns one summary per employee
	 */
	@ApiOperation({ summary: 'Get the per-employee summary of a payroll run' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Payroll summary retrieved' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_VIEW)
	@Get('/:id/summary')
	async getSummary(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollSummary[]> {
		return this.payrollRunService.getSummaryByRun(id, organizationId);
	}

	/**
	 * Open a new payroll run in `DRAFT`.
	 *
	 * @param entity the pay period, pay date, frequency and currency
	 * @returns the created run
	 */
	@ApiOperation({ summary: 'Create a payroll run' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The payroll run has been created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input, check the response body for details' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePayrollRunDTO): Promise<IPayrollRun> {
		return this.payrollRunService.createRun(entity);
	}

	/**
	 * Edit a payroll run that has not been paid.
	 *
	 * @param id the run to update
	 * @param organizationId the organization the run belongs to
	 * @param entity the fields to change
	 * @returns the updated run
	 */
	@ApiOperation({ summary: 'Update a payroll run' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The payroll run has been updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID,
		@Body() entity: UpdatePayrollRunDTO
	): Promise<IPayrollRun> {
		return this.payrollRunService.updateRun(id, organizationId, entity);
	}

	/**
	 * Move a draft run to `PENDING_APPROVAL`.
	 *
	 * @param id the run to submit
	 * @param organizationId the organization the run belongs to
	 * @returns the submitted run
	 */
	@ApiOperation({ summary: 'Submit a payroll run for approval' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The payroll run has been submitted.' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	@Put('/:id/submit')
	@HttpCode(HttpStatus.OK)
	async submitForApproval(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollRun> {
		return this.payrollRunService.submitForApproval(id, organizationId);
	}

	/**
	 * Approve a run that is pending approval.
	 *
	 * @param id the run to approve
	 * @param organizationId the organization the run belongs to
	 * @returns the approved run
	 */
	@ApiOperation({ summary: 'Approve a payroll run' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The payroll run has been approved.' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_APPROVE)
	@Put('/:id/approve')
	@HttpCode(HttpStatus.OK)
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollRun> {
		return this.payrollRunService.approve(id, organizationId);
	}

	/**
	 * Recompute the totals of an approved run and mark it paid.
	 *
	 * @param id the run to process
	 * @param organizationId the organization the run belongs to
	 * @returns the processed run
	 */
	@ApiOperation({ summary: 'Process a payroll run and mark it paid' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The payroll run has been processed.' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_APPROVE)
	@Put('/:id/process')
	@HttpCode(HttpStatus.OK)
	async process(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollRun> {
		return this.payrollRunService.process(id, organizationId);
	}

	/**
	 * Cancel a run that has not been paid.
	 *
	 * @param id the run to cancel
	 * @param organizationId the organization the run belongs to
	 * @returns the cancelled run
	 */
	@ApiOperation({ summary: 'Cancel a payroll run' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The payroll run has been cancelled.' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	@Put('/:id/cancel')
	@HttpCode(HttpStatus.OK)
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<IPayrollRun> {
		return this.payrollRunService.cancel(id, organizationId);
	}

	/**
	 * Add an earning or deduction line to a draft run.
	 *
	 * @param id the run to add the line to
	 * @param entity the line to add
	 * @returns the created line
	 */
	@ApiOperation({ summary: 'Add a line item to a payroll run' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line item has been added.' })
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	@Post('/:id/items')
	@UseValidationPipe({ transform: true, whitelist: true })
	async addItem(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CreatePayrollItemDTO
	): Promise<IPayrollItem> {
		return this.payrollRunService.addItem(id, entity);
	}

	/**
	 * Remove a line from a draft run.
	 *
	 * @param id the run the line belongs to
	 * @param itemId the line to remove
	 * @param organizationId the organization the run belongs to
	 * @returns the delete result
	 */
	@ApiOperation({ summary: 'Remove a line item from a payroll run' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The line item has been removed.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.NO_CONTENT)
	@Permissions(PermissionsEnum.ORG_PAYROLL_EDIT)
	@Delete('/:id/items/:itemId')
	async removeItem(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('itemId', UUIDValidationPipe) itemId: ID,
		@Query('organizationId', UUIDValidationPipe) organizationId: ID
	): Promise<DeleteResult> {
		return this.payrollRunService.removeItem(id, itemId, organizationId);
	}
}
