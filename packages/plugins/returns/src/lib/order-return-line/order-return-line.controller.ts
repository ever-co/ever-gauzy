import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { ReturnsFeatures } from '../returns.features';
import { ReturnsPermissions } from '../returns.permissions';
import { CreateOrderReturnLineDTO, UpdateOrderReturnLineDTO } from './dto';
import { OrderReturnLine } from './order-return-line.entity';
import { OrderReturnLineService } from './order-return-line.service';

/**
 * Return lines.
 *
 * The lines of a return are usually written with the return itself; this surface exists for the
 * operator who corrects one line, and it is the same validator either way — every write goes through
 * the service that checks the request against what was actually fulfilled.
 */
@ApiTags('OrderReturnLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
@Controller('/order-return-lines')
export class OrderReturnLineController extends CrudController<OrderReturnLine> {
	constructor(private readonly orderReturnLineService: OrderReturnLineService) {
		super(orderReturnLineService);
	}

	/**
	 * Lists the lines of a return.
	 *
	 * @param options The filter, including `filter[returnId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List return lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<OrderReturnLine>): Promise<IPagination<OrderReturnLine>> {
		return await this.orderReturnLineService.findAll(options);
	}

	/**
	 * Adds a line to a return that is still open.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a line to a return' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderReturnLineDTO): Promise<OrderReturnLine> {
		OrderReturnLineController.refuseReceiptCounters(entity);

		return await this.orderReturnLineService.create(entity as any);
	}

	/**
	 * Updates a return line.
	 *
	 * **The receipt counters are not a field of the update (R2-G25).** `receivedQuantity` and
	 * `damagedQuantity` are written by receiving the return (`POST /order-returns/:id/receive` /
	 * `receiveOrderReturn`), which moves the stock and the order line's returned quantity with them; the
	 * body's DTO carried both, so this route wrote them raw — a line could be "received" with no goods
	 * having arrived, no stock movement and no order-line counter, and the refund that reads them would pay
	 * for it. No GraphQL field writes them either. They are refused here, on the create as well, with
	 * `400 RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY`, and a line that has already received or written off a
	 * unit may only have its note and metadata changed — the promise `UpdateOrderReturnLineDTO` makes,
	 * which nothing enforced: the quantities a receipt was posted against must not move under it.
	 *
	 * The check and the write are one statement for anything but the note and metadata: the update is
	 * predicated on the counters the check read, so a receipt posted between the read and the write leaves
	 * the statement matching no row, and the request is answered `409 RETURN_LINE_RECEIVED_CONCURRENTLY`
	 * instead of moving a quantity a receipt has just been posted against.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 * @throws BadRequestException `RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY` for a counter in the body, and
	 * `RETURN_LINE_RECEIVED` for any other field than the note or metadata of a line that has received units.
	 * @throws ConflictException `RETURN_LINE_RECEIVED_CONCURRENTLY` when a receipt landed during the update.
	 */
	@ApiOperation({ summary: 'Update a return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderReturnLineDTO
	): Promise<OrderReturnLine> {
		OrderReturnLineController.refuseReceiptCounters(entity);

		const line = await this.orderReturnLineService.findOneByIdString(id);
		const changed = Object.keys(entity ?? {}).filter(
			(field) =>
				(entity as Record<string, unknown>)[field] !== undefined &&
				!OrderReturnLineController.WRITABLE_AFTER_RECEIPT.includes(field)
		);

		if (line && changed.length > 0 && OrderReturnLineController.hasReceived(line)) {
			throw new BadRequestException({
				message:
					'RETURN_LINE_RECEIVED: this line has received units; only its note and metadata can change, because the quantities a receipt was posted against must not move.',
				code: 'RETURN_LINE_RECEIVED',
				details: { fields: changed }
			});
		}

		if (line && changed.length > 0) {
			await this.updateUnlessReceived(line, entity, changed);
		} else {
			await this.orderReturnLineService.update(id, entity as any);
		}

		return await this.orderReturnLineService.findOneByIdString(id);
	}

	/**
	 * Retires a return line. This route no longer erases one.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, whose handler hard-deletes the row.
	 * Return lines are soft delete only (owner decision 2026-10-09): the receipt wrote stock movements and the refund wrote money, and both point back at the row,
	 * so the route now retires the row exactly as `DELETE ':id/soft'` does — through the service's
	 * `softRemove`, which keeps the row with `deletedAt` set and lets `PUT ':id/recover'` bring it back.
	 * There is no hard-delete path through the API. The route's path, status and permission are unchanged.
	 *
	 * @param id The return line to retire.
	 * @param options The inherited rest parameter.
	 * @returns The retired return line.
	 */
	@ApiOperation({ summary: 'Retire a return line (soft delete; it is never hard-deleted)' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The return line was retired.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Soft-deletes a return line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id/soft` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Soft removal is the same destructive write staged for recovery,
	 * so it states `RETURNS_CREATE` as well.
	 *
	 * @param id The return line to soft delete.
	 * @returns The soft-deleted return line.
	 */
	@ApiOperation({ summary: 'Soft delete a return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was soft deleted.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted return line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `PUT :id/recover` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Restoring is the same destructive grant exercised backwards, so
	 * it states `RETURNS_CREATE` as well.
	 *
	 * @param id The return line to restore.
	 * @returns The restored return line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was restored.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * The members a line that has received units may still change: its note and metadata, and the scope
	 * members a client sends with every body (validated by the DTO's base, and not a quantity).
	 */
	private static readonly WRITABLE_AFTER_RECEIPT: readonly string[] = [
		'note',
		'metadata',
		'tenantId',
		'organizationId',
		'organization',
		'sentTo'
	];

	/** The counters only the receiving action writes. */
	private static readonly RECEIPT_COUNTERS = ['receivedQuantity', 'damagedQuantity'] as const;

	/**
	 * Refuses a body that states a receipt counter. See {@link update}.
	 *
	 * @param entity The body.
	 * @throws BadRequestException `RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY`.
	 */
	private static refuseReceiptCounters(entity: object | undefined): void {
		const stated = OrderReturnLineController.RECEIPT_COUNTERS.filter(
			(field) => (entity as Record<string, unknown> | undefined)?.[field] !== undefined
		);

		if (stated.length > 0) {
			throw new BadRequestException({
				message:
					'RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY: received and damaged quantities are written by receiving the return (POST /order-returns/:id/receive), never by a line write.',
				code: 'RETURN_LINE_RECEIPT_COUNTERS_READ_ONLY',
				details: { fields: stated }
			});
		}
	}

	/**
	 * Writes the update predicated on the receipt counters the check read. See {@link update}.
	 *
	 * The tenant-aware update reads the row by the same criteria before it writes, and answers a miss with
	 * a 404; either a miss there or an update that matched no row means the counters moved in between.
	 *
	 * @param line The line as the check read it.
	 * @param entity The body.
	 * @param changed The members other than note and metadata the body states.
	 * @throws ConflictException `RETURN_LINE_RECEIVED_CONCURRENTLY`.
	 */
	private async updateUnlessReceived(
		line: OrderReturnLine,
		entity: UpdateOrderReturnLineDTO,
		changed: string[]
	): Promise<void> {
		const conflict = () =>
			new ConflictException({
				message:
					'RETURN_LINE_RECEIVED_CONCURRENTLY: a receipt was posted against this line while it was being changed; read it again.',
				code: 'RETURN_LINE_RECEIVED_CONCURRENTLY',
				details: { fields: changed }
			});
		let result: unknown;

		try {
			result = await this.orderReturnLineService.update(
				{
					id: line.id,
					receivedQuantity: line.receivedQuantity,
					damagedQuantity: line.damagedQuantity
				} as any,
				entity as any
			);
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw conflict();
			}

			throw error;
		}

		const affected = (result as { affected?: number } | undefined)?.affected;

		if (typeof affected === 'number' && affected === 0) {
			throw conflict();
		}
	}

	/**
	 * Whether a receipt has been posted against the line.
	 *
	 * @param line The line as stored.
	 * @returns True when any unit was received or written off as damaged.
	 */
	private static hasReceived(line: OrderReturnLine): boolean {
		return Number(line.receivedQuantity ?? 0) > 0 || Number(line.damagedQuantity ?? 0) > 0;
	}
}
