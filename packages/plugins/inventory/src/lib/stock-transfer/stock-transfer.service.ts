import { ConflictException, Injectable } from '@nestjs/common';
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
 * Refusal code of a transition a caller attempted from a version the document has moved past.
 *
 * It belongs to this document rather than to the shared refusal vocabulary: a transfer transition is
 * what states an expected version, and a caller branches on this code to decide whether to re-read
 * the document and try again.
 */
const TRANSFER_VERSION_CONFLICT = 'STOCK_TRANSFER_VERSION_CONFLICT';

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

	/**
	 * Moves a draft transfer into the requested state.
	 *
	 * @param id Id of the transfer.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	public async request(id: ID, expectedVersion?: number): Promise<StockTransfer> {
		return await this.transition(id, StockTransferStatus.REQUESTED, {}, expectedVersion);
	}

	/**
	 * Approves a requested transfer.
	 *
	 * @param id Id of the transfer.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	public async approve(id: ID, expectedVersion?: number): Promise<StockTransfer> {
		return await this.transition(id, StockTransferStatus.APPROVED, {}, expectedVersion);
	}

	/**
	 * Dispatches a transfer.
	 *
	 * Each line writes one outbound movement at the source location, so the source’s on-hand quantity
	 * drops in the same transaction that records the dispatch. The destination is not touched: the
	 * stock has left and has not arrived, and pretending otherwise would make one of the two
	 * locations wrong.
	 *
	 * @param id Id of the transfer.
	 * @param lines What each line dispatches.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	public async ship(
		id: ID,
		lines: Array<{ lineId: ID; shippedQuantity: number }>,
		expectedVersion?: number
	): Promise<StockTransfer> {
		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const transfer = await this.requireState(manager, id, [StockTransferStatus.APPROVED], expectedVersion);

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

			return await this.commitTransition(manager, transfer, {
				status: StockTransferStatus.IN_TRANSIT,
				shippedAt: new Date()
			});
		});
	}

	/**
	 * Receives a transfer.
	 *
	 * Arrived units write an inbound movement at the destination, damaged units are recorded on the
	 * line so the loss is visible, and a shortfall never silently disappears: what did not arrive
	 * simply did not arrive, and the line says so.
	 *
	 * @param id Id of the transfer.
	 * @param lines What each line received.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	public async receive(
		id: ID,
		lines: Array<{ lineId: ID; receivedQuantity: number; damagedQuantity?: number }>,
		expectedVersion?: number
	): Promise<StockTransfer> {
		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const transfer = await this.requireState(
				manager,
				id,
				[StockTransferStatus.IN_TRANSIT, StockTransferStatus.PARTIALLY_RECEIVED],
				expectedVersion
			);

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

			return await this.commitTransition(manager, transfer, {
				status: complete ? StockTransferStatus.RECEIVED : StockTransferStatus.PARTIALLY_RECEIVED,
				receivedAt: complete ? new Date() : transfer.receivedAt
			});
		});
	}

	/**
	 * Cancels a transfer that has not been fully received.
	 *
	 * @param id Id of the transfer.
	 * @param reason Why it was cancelled.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	public async cancel(id: ID, reason?: string, expectedVersion?: number): Promise<StockTransfer> {
		return await this.transition(id, StockTransferStatus.CANCELED, { note: reason }, expectedVersion);
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Loads a transfer and refuses the transition when the document is at another version or in the
	 * wrong state.
	 *
	 * @param manager The transaction the transition runs in.
	 * @param id Id of the transfer.
	 * @param expected The statuses the transition may start from.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	private async requireState(
		manager: any,
		id: ID,
		expected: StockTransferStatus[],
		expectedVersion?: number
	): Promise<StockTransfer> {
		const transfer = await manager.findOne(StockTransfer, { where: { id } });
		if (!transfer) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer does not exist.', {
				notFound: true,
				details: { transferId: id }
			});
		}
		this.assertVersion(transfer, expectedVersion);
		if (!expected.includes(transfer.status)) {
			throw inventoryError(
				InventoryErrorCode.TRANSFER_ILLEGAL_TRANSITION,
				`A transfer cannot move from ${transfer.status} to the requested state.`,
				{ details: { transferId: id, status: transfer.status, expected } }
			);
		}
		return transfer;
	}

	/**
	 * Applies a state transition that has no stock effect of its own.
	 *
	 * @param id Id of the transfer.
	 * @param status The state the transition reaches.
	 * @param patch The columns the transition writes beside the state.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 */
	private async transition(
		id: ID,
		status: StockTransferStatus,
		patch: Partial<StockTransfer>,
		expectedVersion?: number
	): Promise<StockTransfer> {
		return await this.typeOrmStockTransferRepository.manager.transaction(async (manager) => {
			const transfer = await manager.findOne(StockTransfer, { where: { id } });
			if (!transfer) {
				throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer does not exist.', {
					notFound: true,
					details: { transferId: id }
				});
			}
			this.assertVersion(transfer, expectedVersion);
			if (!ALLOWED_FROM[status].includes(transfer.status)) {
				throw inventoryError(
					InventoryErrorCode.TRANSFER_ILLEGAL_TRANSITION,
					`A transfer cannot move from ${transfer.status} to ${status}.`,
					{ details: { transferId: id, status: transfer.status, requestedStatus: status } }
				);
			}

			return await this.commitTransition(manager, transfer, { ...patch, status });
		});
	}

	/**
	 * Writes the state a transition reached, under the version the document was read at.
	 *
	 * The comparison and the write are one statement — `UPDATE … WHERE id = ? AND version = ?` — which
	 * is what makes the guard a guard: two operators acting on the same reading of a transfer cannot
	 * both land, because the first write moves the row to the next version and the second then matches
	 * nothing. A read followed by an unguarded write would leave exactly the window this closes, and
	 * the loser would be told so with a version conflict rather than silently moving stock a second
	 * time. The row that was written is also what the caller is answered with, so the answer states
	 * the version the document now holds.
	 *
	 * @param manager The transaction the transition runs in.
	 * @param transfer The transfer as it was read, inside that transaction.
	 * @param patch The columns the transition writes.
	 * @returns The transfer at the version this write produced.
	 * @throws ConflictException When the document has moved past the version it was read at.
	 */
	private async commitTransition(
		manager: any,
		transfer: StockTransfer,
		patch: Partial<StockTransfer>
	): Promise<StockTransfer> {
		const version = Number(transfer.version ?? 1);
		const next = version + 1;
		const update = await manager
			.createQueryBuilder()
			.update(StockTransfer)
			.set({ ...patch, version: next })
			.where('id = :id AND version = :version', { id: transfer.id, version })
			.execute();

		if (!update.affected) {
			throw this.versionConflict(transfer.id, version);
		}

		return Object.assign(transfer, patch, { version: next });
	}

	/**
	 * Refuses a transition a caller attempted from a version the document has already moved past.
	 *
	 * A caller that states no version is not refused here: the version is its precondition to state,
	 * and the transition it asks for is still evaluated against the status the document is in.
	 *
	 * @param transfer The transfer as it was read.
	 * @param expectedVersion The version the caller acted on, when it stated one.
	 * @throws ConflictException When the two differ.
	 */
	private assertVersion(transfer: Pick<StockTransfer, 'id' | 'version'>, expectedVersion?: number): void {
		if (expectedVersion === undefined || expectedVersion === null) {
			return;
		}

		const current = Number(transfer.version ?? 1);
		if (current !== Number(expectedVersion)) {
			throw this.versionConflict(transfer.id, current, expectedVersion);
		}
	}

	/**
	 * @param transferId The transfer the write was refused on.
	 * @param actualVersion The version the document holds.
	 * @param expectedVersion The version the caller acted on, when it was stated.
	 * @returns The refusal, carrying both versions so a caller can re-read and reapply.
	 */
	private versionConflict(transferId: ID, actualVersion: number, expectedVersion?: number): ConflictException {
		return new ConflictException({
			code: TRANSFER_VERSION_CONFLICT,
			message:
				expectedVersion === undefined
					? `The transfer has moved on to version ${actualVersion} since it was read.`
					: `The transfer has moved on to version ${actualVersion}, not the ${expectedVersion} this request acted on.`,
			details: { transferId, actualVersion, ...(expectedVersion === undefined ? {} : { expectedVersion }) }
		});
	}
}
