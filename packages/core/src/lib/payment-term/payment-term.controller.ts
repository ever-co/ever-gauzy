import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
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
}
