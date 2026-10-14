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
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { ILineInvoicePosition } from '../order.types';
import { OrderLineInvoice } from './order-line-invoice.entity';
import { OrderLineInvoiceService } from './order-line-invoice.service';
import { CreateOrderLineInvoiceDTO, UpdateOrderLineInvoiceDTO } from './dto';

/**
 * The register that makes a partial invoice, and a partial credit, expressible.
 *
 * One surface, on the concept's own path, under the order's own permissions: a link is not an
 * accounting document of its own, it is the order's record of what a document billed against one of
 * its lines, and the role that may work an order is the role that may read and write it.
 *
 * The reading routes are the point of the resource as much as the writing one. `position` answers "how
 * much of this line is left to bill" from the counters and the basis, and the collection answers what
 * has been billed and credited so far — which is what a support conversation, a reconciliation and the
 * nightly audit all ask.
 */
@ApiTags('OrderLineInvoice')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
@Controller('/order-line-invoices')
export class OrderLineInvoiceController extends CrudController<OrderLineInvoice> {
	constructor(private readonly service: OrderLineInvoiceService) {
		super(service);
	}

	/**
	 * Lists links.
	 *
	 * @param options The filter, including `filter[orderLineId]` and `filter[direction]`.
	 * @returns The links, paginated.
	 */
	@ApiOperation({ summary: 'List line-to-invoice links' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The links were listed.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<OrderLineInvoice>): Promise<IPagination<OrderLineInvoice>> {
		return await this.service.findAll(options as any);
	}

	/**
	 * Reads the links of one order line.
	 *
	 * @param id The order line.
	 * @returns Every item and credit-note item the line was billed through, oldest first.
	 */
	@ApiOperation({ summary: 'List the links of one order line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The links of the line.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Get('/by-line/:id')
	async listForLine(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderLineInvoice[]> {
		return await this.service.listForLine(id);
	}

	/**
	 * Reads how much of one line is left to bill.
	 *
	 * @param id The order line.
	 * @param basisQuantity The quantity the line is invoiced against; the ordered quantity when omitted.
	 * @returns The counters, the outstanding quantity and the status they imply.
	 */
	@ApiOperation({ summary: 'Read the invoicing position of one order line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The position of the line.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such order line in this organization.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Get('/position/:id')
	async position(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('basisQuantity') basisQuantity?: string
	): Promise<ILineInvoicePosition> {
		return await this.service.positionFor(id, basisQuantity);
	}

	/**
	 * Reads one link.
	 *
	 * @param id The link.
	 * @returns The link.
	 */
	@ApiOperation({ summary: 'Read one line-to-invoice link' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The link was found.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderLineInvoice> {
		return await this.service.findOneByIdString(id);
	}

	/**
	 * Records a link and moves the line's counters with it.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all. Declaring the DTO is what makes the
	 * request validated, and it is also what gives the route a documented body.
	 *
	 * @param entity The link to record.
	 * @returns The stored link, and the line as it now stands.
	 */
	@ApiOperation({ summary: 'Record a line-to-invoice link' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The link was recorded and the counters moved.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The link is not usable, or a credit exceeds what was invoiced.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderLineInvoiceDTO): Promise<any> {
		return await this.service.record(entity);
	}

	/**
	 * Amends a link's tenant extras.
	 *
	 * Only `metadata` is writable: the rest of the row describes an issued document. The return type is
	 * the service's own answer — a link — while the base class's `update` answers with the ORM's update
	 * result as readily as with the row, so narrowing it here would be untrue.
	 *
	 * @param id The link.
	 * @param entity The members to change.
	 * @returns The link, as it now stands.
	 */
	@ApiOperation({ summary: 'Amend the tenant extras of a line-to-invoice link' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The link was amended.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A member other than metadata was stated.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderLineInvoiceDTO
	): Promise<OrderLineInvoice> {
		return await this.service.updateOne(id, entity as any);
	}

	/**
	 * Re-derives a line's counters from its links.
	 *
	 * The reconciliation route: the counters are a cache, and this is what a job compares them against.
	 *
	 * @param id The order line.
	 * @param basisQuantity The quantity the line is invoiced against; the ordered quantity when omitted.
	 * @returns The line, with its counters re-derived.
	 */
	@ApiOperation({ summary: 'Re-derive the invoicing counters of an order line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The counters were re-derived from the links.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Post('/recompute/:id')
	async recompute(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('basisQuantity') basisQuantity?: string
	): Promise<unknown> {
		return await this.service.recomputeCounters(id, basisQuantity);
	}

	/**
	 * Removes a link and re-derives the counters from what remains.
	 *
	 * The row is soft-deleted: the reconciliation has to be able to explain a counter that moved, and a
	 * link that disappeared entirely would leave the difference as a number with no history.
	 *
	 * @param id The link.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Remove a line-to-invoice link' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The link was removed and the counters re-derived.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such link in this organization.' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a line-to-invoice link by id.
	 *
	 * `CrudController` declares this route with no permission metadata at all, and `PermissionGuard`
	 * returns `true` to empty metadata — the `isEmpty(permissions)` branch in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited route was reachable on
	 * this controller's class-level view grant alone. The override restates the route and its body
	 * unchanged and adds only the permission the base class omits: `ORDERS_EDIT`, the grant the `delete`
	 * route above already requires.
	 *
	 * @param id The link.
	 * @returns The soft-deleted link.
	 */
	@ApiOperation({ summary: 'Soft delete a line-to-invoice link' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The link was soft deleted' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted line-to-invoice link by id.
	 *
	 * The route is `CrudController`'s, declared there with no permission metadata whatsoever, and
	 * `PermissionGuard` treats empty metadata as authorization — it returns `true` in the
	 * `isEmpty(permissions)` branch of `packages/core/src/lib/shared/guards/permission.guard.ts` — which is
	 * what left the inherited handler open to every authenticated member of the tenant. This override
	 * exists only to state its permission, `ORDERS_EDIT`, on the same path and the same body.
	 *
	 * @param id The link.
	 * @returns The restored link.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted line-to-invoice link' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The link was restored' })
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
