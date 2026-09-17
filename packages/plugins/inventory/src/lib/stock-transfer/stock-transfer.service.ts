import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { StockMovementType, StockMovementReferenceType, StockTransferStatus } from './../inventory.enums';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { InventorySequenceService } from './../inventory-sequence.service';
import { StockLevelService } from './../stock-level/stock-level.service';
import { StockTransferLine } from './../stock-transfer-line/stock-transfer-line.entity';
import { StockTransfer } from './stock-transfer.entity';
import { TypeOrmStockTransferRepository } from './repository/type-orm-stock-transfer.repository';
import { MikroOrmStockTransferRepository } from './repository/mikro-orm-stock-transfer.repository';

/** Which state a transition may start from. */
const ALLOWED_FROM: Record<StockTransferStatus, StockTransferStatus[]> = {
	[StockTransferStatus.DRAFT]: [],
	[StockTransferStatus.REQUESTED]: [StockTransferStatus.DRAFT],
	[StockTransferStatus.APPROVED]: [StockTransferStatus.REQUESTED],
	[StockTransferStatus.IN_TRANSIT]: [StockTransferStatus.APPROVED],
	[StockTransferStatus.PARTIALLY_RECEIVED]: [StockTransferStatus.IN_TRANSIT],
	[StockTransferStatus.RECEIVED]: [StockTransferStatus.IN_TRANSIT, StockTransferStatus.PARTIALLY_RECEIVED],
	[StockTransferStatus.CANCELED]: [
		StockTransferStatus.DRAFT,
		StockTransferStatus.REQUESTED,
		StockTransferStatus.APPROVED,
		StockTransferStatus.IN_TRANSIT,
		StockTransferStatus.PARTIALLY_RECEIVED
	]
};

/**
 * Moves stock between locations.
 *
 * Dispatch writes the outbound movement at the source, receipt writes the inbound movement at the
 * destination, and the two never happen at once: a transfer in transit has left one location and has
 * not arrived at the other, which is exactly what the two-movement shape records.
 */
@Injectable()
export class StockTransferService extends TenantAwareCrudService<StockTransfer> {
	constructor(
		readonly typeOrmStockTransferRepository: TypeOrmStockTransferRepository,
		readonly mikroOrmStockTransferRepository: MikroOrmStockTransferRepository,
		private readonly sequenceService: InventorySequenceService,
		private readonly stockLevelService: StockLevelService
	) {
		super(typeOrmStockTransferRepository, mikroOrmStockTransferRepository);
	}

	/** Lists transfers with the filters the resource exposes. */
	public async findTransfers(filter?: FindManyOptions<StockTransfer>): Promise<IPagination<StockTransfer>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Creates a draft transfer and numbers it.
	 *
	 * A transfer between one location and itself is refused by the database as well as here: the
	 * constraint states the rule once, so no code path can create a document that has no meaning.
	 */
	public async createTransfer(input: {
		fromWarehouseId: ID;
		toWarehouseId: ID;
		note?: string;
		lines?: Array<{ variantId: ID; requestedQuantity: number; unitCost?: number; note?: string }>;
	}): Promise<StockTransfer> {
		if (input.fromWarehouseId === input.toWarehouseId) {
			throw inventoryError(
				InventoryErrorCode.TRANSFER_SAME_LOCATION,
				'A transfer must move stock between two different locations.',
				{ badRequest: true, details: { warehouseId: input.fromWarehouseId } }
			);
		}

		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const { formatted } = await this.sequenceService.allocate('TRANSFER');
			const transfer = manager.create(StockTransfer, {
				number: formatted,
				fromWarehouseId: input.fromWarehouseId,
				toWarehouseId: input.toWarehouseId,
				status: StockTransferStatus.DRAFT,
				note: input.note,
				version: 1,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as Partial<StockTransfer>);
			const saved = await manager.save(StockTransfer, transfer);

			if (input.lines?.length) {
				const lines = input.lines.map((line) =>
					manager.create(StockTransferLine, {
						transferId: saved.id,
						variantId: line.variantId,
						requestedQuantity: line.requestedQuantity,
						shippedQuantity: 0,
						receivedQuantity: 0,
						damagedQuantity: 0,
						unitCost: line.unitCost,
						note: line.note,
						tenantId: saved.tenantId,
						organizationId: saved.organizationId
					} as Partial<StockTransferLine>)
				);
				await manager.save(StockTransferLine, lines);
			}

			return saved;
		});
	}

	/** Moves a draft transfer into the requested state. */
	public async request(id: ID): Promise<StockTransfer> {
		return await this.transition(id, StockTransferStatus.REQUESTED, {});
	}

	/** Approves a requested transfer. */
	public async approve(id: ID): Promise<StockTransfer> {
		return await this.transition(id, StockTransferStatus.APPROVED, {});
	}

	/**
	 * Dispatches a transfer.
	 *
	 * Each line writes one outbound movement at the source location, so the source’s on-hand quantity
	 * drops in the same transaction that records the dispatch. The destination is not touched: the
	 * stock has left and has not arrived, and pretending otherwise would make one of the two
	 * locations wrong.
	 */
	public async ship(id: ID, lines: Array<{ lineId: ID; shippedQuantity: number }>): Promise<StockTransfer> {
		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const transfer = await this.requireState(manager, id, [StockTransferStatus.APPROVED]);

			for (const input of lines) {
				const line = await manager.findOne(StockTransferLine, { where: { id: input.lineId, transferId: id } });
				if (!line) {
					throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer line does not exist.', {
						notFound: true,
						details: { lineId: input.lineId }
					});
				}
				const shipped = Number(input.shippedQuantity);
				if (shipped < 0 || shipped > Number(line.requestedQuantity)) {
					throw inventoryError(
						InventoryErrorCode.TRANSFER_OVER_RECEIPT,
						'A line cannot ship more than it requested.',
						{ details: { lineId: line.id, requested: Number(line.requestedQuantity), shipped } }
					);
				}
				if (shipped === 0) {
					continue;
				}

				line.shippedQuantity = shipped;
				await manager.save(StockTransferLine, line);

				await this.stockLevelService.applyMovement({
					warehouseId: transfer.fromWarehouseId,
					variantId: line.variantId,
					type: StockMovementType.TRANSFER_OUT,
					quantityDelta: -shipped,
					reservedDelta: 0,
					referenceType: StockMovementReferenceType.TRANSFER,
					referenceId: line.id,
					reason: 'TRANSFER_SHIP'
				});
			}

			transfer.status = StockTransferStatus.IN_TRANSIT;
			transfer.shippedAt = new Date();
			transfer.version = Number(transfer.version ?? 1) + 1;
			return await manager.save(StockTransfer, transfer);
		});
	}

	/**
	 * Receives a transfer.
	 *
	 * Arrived units write an inbound movement at the destination, damaged units are recorded on the
	 * line so the loss is visible, and a shortfall never silently disappears: what did not arrive
	 * simply did not arrive, and the line says so.
	 */
	public async receive(
		id: ID,
		lines: Array<{ lineId: ID; receivedQuantity: number; damagedQuantity?: number }>
	): Promise<StockTransfer> {
		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const transfer = await this.requireState(manager, id, [
				StockTransferStatus.IN_TRANSIT,
				StockTransferStatus.PARTIALLY_RECEIVED
			]);

			for (const input of lines) {
				const line = await manager.findOne(StockTransferLine, { where: { id: input.lineId, transferId: id } });
				if (!line) {
					throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer line does not exist.', {
						notFound: true,
						details: { lineId: input.lineId }
					});
				}

				const received = Number(input.receivedQuantity) + Number(line.receivedQuantity ?? 0);
				const damaged = Number(input.damagedQuantity ?? 0) + Number(line.damagedQuantity ?? 0);
				if (received + damaged > Number(line.shippedQuantity)) {
					throw inventoryError(
						InventoryErrorCode.TRANSFER_OVER_RECEIPT,
						'A line cannot receive more than it shipped.',
						{ details: { lineId: line.id, shipped: Number(line.shippedQuantity), received, damaged } }
					);
				}

				line.receivedQuantity = received;
				line.damagedQuantity = damaged;
				await manager.save(StockTransferLine, line);

				if (Number(input.receivedQuantity) > 0) {
					await this.stockLevelService.applyMovement({
						warehouseId: transfer.toWarehouseId,
						variantId: line.variantId,
						type: StockMovementType.TRANSFER_IN,
						quantityDelta: Number(input.receivedQuantity),
						reservedDelta: 0,
						referenceType: StockMovementReferenceType.TRANSFER,
						referenceId: line.id,
						reason: 'TRANSFER_RECEIVE'
					});
				}
				if (Number(input.damagedQuantity ?? 0) > 0) {
					await this.stockLevelService.applyMovement({
						warehouseId: transfer.toWarehouseId,
						variantId: line.variantId,
						type: StockMovementType.DAMAGE,
						quantityDelta: 0,
						reservedDelta: 0,
						referenceType: StockMovementReferenceType.TRANSFER,
						referenceId: line.id,
						reason: 'DAMAGE'
					});
				}
			}

			const all = await manager.find(StockTransferLine, { where: { transferId: id } });
			const complete = all.every(
				(line) => Number(line.receivedQuantity ?? 0) + Number(line.damagedQuantity ?? 0) >= Number(line.shippedQuantity ?? 0)
			);

			transfer.status = complete ? StockTransferStatus.RECEIVED : StockTransferStatus.PARTIALLY_RECEIVED;
			transfer.receivedAt = complete ? new Date() : transfer.receivedAt;
			transfer.version = Number(transfer.version ?? 1) + 1;
			return await manager.save(StockTransfer, transfer);
		});
	}

	/** Cancels a transfer that has not been fully received. */
	public async cancel(id: ID, reason?: string): Promise<StockTransfer> {
		return await this.transition(id, StockTransferStatus.CANCELED, { note: reason });
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/** Loads a transfer and refuses the transition when it is in the wrong state. */
	private async requireState(
		manager: any,
		id: ID,
		expected: StockTransferStatus[]
	): Promise<StockTransfer> {
		const transfer = await manager.findOne(StockTransfer, { where: { id } });
		if (!transfer) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer does not exist.', {
				notFound: true,
				details: { transferId: id }
			});
		}
		if (!expected.includes(transfer.status)) {
			throw inventoryError(
				InventoryErrorCode.TRANSFER_ILLEGAL_TRANSITION,
				`A transfer cannot move from ${transfer.status} to the requested state.`,
				{ details: { transferId: id, status: transfer.status, expected } }
			);
		}
		return transfer;
	}

	/** Applies a state transition that has no stock effect of its own. */
	private async transition(
		id: ID,
		status: StockTransferStatus,
		patch: Partial<StockTransfer>
	): Promise<StockTransfer> {
		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const transfer = await manager.findOne(StockTransfer, { where: { id } });
			if (!transfer) {
				throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer does not exist.', {
					notFound: true,
					details: { transferId: id }
				});
			}
			if (!ALLOWED_FROM[status].includes(transfer.status)) {
				throw inventoryError(
					InventoryErrorCode.TRANSFER_ILLEGAL_TRANSITION,
					`A transfer cannot move from ${transfer.status} to ${status}.`,
					{ details: { transferId: id, status: transfer.status, requestedStatus: status } }
				);
			}

			Object.assign(transfer, patch);
			transfer.status = status;
			transfer.version = Number(transfer.version ?? 1) + 1;
			return await manager.save(StockTransfer, transfer);
		});
	}
}
