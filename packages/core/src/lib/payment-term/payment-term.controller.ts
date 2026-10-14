import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination, ID } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { PaymentTerm } from './payment-term.entity';
import { IPaymentTermSchedule, PaymentTermService } from './payment-term.service';
import { PAYMENT_TERM_PERMISSIONS } from './payment-term.permissions';
import {
	CreatePaymentTermDTO,
	PaymentTermScheduleDTO,
	UpdatePaymentTermDTO,
	UpdatePaymentTermLinesDTO
} from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';

/**
 * The settlement terms an operator administers, over REST.
 *
 * The path is the plural concept — `/payment-terms` — with no capability segment: a term is read by the
 * accounting document and by procurement alike, and a path naming either would be a boundary drawn by
 * audience rather than by concept.
 *
 * The instalments have no route of their own. An instalment is addressed by its position inside the
 * term that owns it, so the term's own endpoints carry its lines and `PUT /payment-terms/:id/lines` is
 * the whole write surface an instalment has — the alternative would be a second resource whose rows
 * have no meaning outside the header, which is the 1:1 companion shape the placement doctrine forbids.
 */
@ApiTags('PaymentTerm')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
@Controller('/payment-terms')
export class PaymentTermController extends CrudController<PaymentTerm> {
	constructor(private readonly paymentTermService: PaymentTermService) {
		super(paymentTermService);
	}

	/**
	 * Lists the settlement terms of the caller's organization.
	 */
	@ApiOperation({ summary: 'List the settlement terms of this organization.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Found settlement terms', type: PaymentTerm })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<PaymentTerm>): Promise<IPagination<PaymentTerm>> {
		return this.paymentTermService.findAll(params);
	}

	/**
	 * Declares a term and the instalments that make up its schedule.
	 */
	@ApiOperation({ summary: 'Declare a settlement term with its instalments.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The settlement term', type: PaymentTerm })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PAYMENT_TERM_LINES_INVALID or PAYMENT_TERM_PERCENT_SUM' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreatePaymentTermDTO): Promise<PaymentTerm> {
		return this.paymentTermService.createTerm(entity);
	}

	/**
	 * Changes a term's header fields. Its instalments are changed by their own operation.
	 */
	@ApiOperation({ summary: 'Change a settlement term.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The settlement term' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe()
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdatePaymentTermDTO): Promise<PaymentTerm> {
		return this.paymentTermService.updateTerm(id, entity);
	}

	/**
	 * Replaces a term's instalments.
	 */
	@ApiOperation({ summary: 'Replace the instalments of a settlement term.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The settlement term' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'PAYMENT_TERM_LINES_INVALID or PAYMENT_TERM_PERCENT_SUM' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/lines')
	@UseValidationPipe()
	async updateLines(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdatePaymentTermLinesDTO
	): Promise<PaymentTerm> {
		return this.paymentTermService.updateLines(id, entity.lines);
	}

	/**
	 * Archives a term.
	 *
	 * A term referenced by a party, an order, an invoice or a purchase order is archived and never
	 * hard-deleted: those documents name the term they were settled against, and the term is how their
	 * dates are explained.
	 */
	@ApiOperation({ summary: 'Archive a settlement term.' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The term was archived' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string) {
		await this.paymentTermService.getTerm(id);

		return this.paymentTermService.softRemove(id);
	}

	/**
	 * The schedule a term produces for one document.
	 *
	 * Derivation rather than storage: nothing is written, and the answer depends on the amount and the
	 * basis date the caller supplies. `POST` rather than `GET` because the request is a computation over
	 * a body rather than a read of a resource, and because a long amount list does not belong in a query
	 * string.
	 */
	@ApiOperation({ summary: 'Derive the schedule a settlement term produces for one amount.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The derived schedule' })
	@ApiResponse({ status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'PAYMENT_TERM_OVERALLOCATED' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
	@HttpCode(HttpStatus.OK)
	@Post(':id/schedule')
	@UseValidationPipe()
	async schedule(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: PaymentTermScheduleDTO
	): Promise<IPaymentTermSchedule> {
		return this.paymentTermService.schedule(
			id,
			entity.total,
			entity.currencyDecimals ?? 2,
			entity.basisDate,
			entity.currency
		);
	}

	/**
	 * Withdraws a payment term without removing the row — the `DELETE /:id/soft` route the CRUD base maps.
	 *
	 * Restated only to state its permission. Left inherited, the route carried none, and `PermissionGuard` —
	 * handler first, then class — authorised it on this class's read grant (`PAYMENT_TERMS_VIEW`), so a role that
	 * may only look could withdraw a row. The soft-delete/recover pair requires the controller's own edit grant,
	 * the one `update` states (owner decision 5, 2026-10-13); the status code, the path, the validation and the
	 * service call are the inherited route's own, so the change is who may call it and nothing else. The GraphQL
	 * field that mirrors it states the same grant.
	 *
	 * @param id The row to withdraw.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The withdrawn row.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<PaymentTerm> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a withdrawn row — the `PUT /:id/recover` route the CRUD base maps.
	 *
	 * Restated for the reason the withdrawal above is: restoring undoes a removal, so it requires the same edit
	 * grant (owner decision 5) rather than the class's read grant (`PAYMENT_TERMS_VIEW`) the inherited route stood on.
	 *
	 * @param id The row to restore.
	 * @param options The inherited route's rest parameter, forwarded to the service unchanged.
	 * @returns The restored row.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<PaymentTerm> {
		return await super.softRecover(id, ...options);
	}
}
