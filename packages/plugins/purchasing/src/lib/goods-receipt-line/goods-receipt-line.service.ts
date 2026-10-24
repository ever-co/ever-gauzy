import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, EntityManager, FindOptionsWhere, In, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { DecimalString, ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { GoodsReceipt } from '../goods-receipt/goods-receipt.entity';
import { GoodsReceiptStatus } from '../purchasing.types';
import { immutableMembers, movedMembers } from '../purchasing.immutable';
import { GoodsReceiptLine } from './goods-receipt-line.entity';
import { PurchasingCrudService } from '../purchasing-crud.service';

/**
 * The members of a line its posted movement was written for, and that its reversal reads back: the variant, the bin
 * the units were put away in, and their lot and expiry. A reversal takes the units out of `warehouseBinId` with the
 * line's `batchNumber` / `expiresAt`, so a line re-pointed at another bin or lot after posting would be reversed out
 * of a position its units never entered (review R2-12; #10562's GraphQL `updateGoodsReceiptLine` exposes them too).
 */
const POSTED_LINE_MEMBERS = ['variantId', 'warehouseBinId', 'batchNumber', 'expiresAt'] as const;
import { MikroOrmGoodsReceiptLineRepository } from './repository/mikro-orm-goods-receipt-line.repository';
import { TypeOrmGoodsReceiptLineRepository } from './repository/type-orm-goods-receipt-line.repository';

/** What the receipt service hands this service when a delivery is recorded. */
export interface IGoodsReceiptLineWrite {
	/** The order line the units are against. */
	purchaseOrderLineId: ID;
	/** The variant that arrived, resolved from the order line. */
	variantId: ID;
	/** Good units that go into sellable stock. */
	quantity: DecimalString;
	/** Units that arrived unsellable. */
	damagedQuantity: DecimalString;
	/** Actual landed cost per unit. */
	unitCost: DecimalString;
	/** Lot or batch the units carry. */
	batchNumber?: string;
	/** Shelf life of the units. */
	expiresAt?: Date;
	/** Bin the units are to be placed into. */
	warehouseBinId?: ID;
	/** Operator note for the line. */
	note?: string;
}

/**
 * The lines of a goods receipt.
 *
 * A receipt line is written once, with the quantities that arrived and the movement it produced. It
 * is the ledger's explanation for that movement, so there is deliberately no method here that rewrites
 * a line's quantities after the fact: correcting a receipt is the receipt service's reversal, which
 * writes the compensating movements and puts the received counters back on the order.
 */
@Injectable()
export class GoodsReceiptLineService extends PurchasingCrudService<GoodsReceiptLine> {
	constructor(
		readonly typeOrmGoodsReceiptLineRepository: TypeOrmGoodsReceiptLineRepository,
		readonly mikroOrmGoodsReceiptLineRepository: MikroOrmGoodsReceiptLineRepository
	) {
		super(typeOrmGoodsReceiptLineRepository, mikroOrmGoodsReceiptLineRepository);
	}

	/**
	 * Annotates a receipt line, refusing a change to what its movement was written for: the variant, the bin, the lot
	 * and the expiry.
	 *
	 * `PUT /goods-receipt-lines/:id` strips the quantities, the cost, the movement link, the receipt and the order
	 * line from its body before it writes, and it did not strip `variantId` (handover 2026-09-20 §7.65 item 23
	 * (c)). Every line is written by a posting — a receipt is born `POSTED`, and a line written on its own goes
	 * through the same posting — so its movement already stands for the variant it named; re-pointing the line
	 * left that movement, and the stock it put on hand, describing a variant the line no longer names. The
	 * refusal is made here, below the route, so every caller of the generic update is held to it. The bin, the lot
	 * and the expiry are held the same way, because the reversal takes the units back out of that bin with that lot
	 * (R2-12). The route and its DTO are unchanged; a member restated as stored is accepted, and the note stays free.
	 *
	 * @param id The line, or the conditions that select the lines to annotate.
	 * @param partialEntity The members to change.
	 * @returns The update result, as the base class answers it.
	 * @throws BadRequestException with `GOODS_RECEIPT_LINE_IMMUTABLE` when the annotation would re-point a line at
	 * another variant, bin, lot or expiry.
	 */
	public async update(
		id: ID | FindOptionsWhere<GoodsReceiptLine>,
		partialEntity: QueryDeepPartialEntity<GoodsReceiptLine>
	): Promise<GoodsReceiptLine | UpdateResult> {
		const patch = (partialEntity ?? {}) as Record<string, unknown>;

		if (POSTED_LINE_MEMBERS.some((member) => patch[member] !== undefined)) {
			const current = typeof id === 'string' ? [await this.findOneByIdString(id)] : await this.find({ where: id });

			for (const line of current) {
				const moved = movedMembers(line as unknown as Record<string, unknown>, patch, POSTED_LINE_MEMBERS);

				if (moved.length > 0) {
					throw immutableMembers(
						'GOODS_RECEIPT_LINE_IMMUTABLE',
						`an annotation cannot change ${moved.join(', ')} of goods receipt line '${line.id}', because the ` +
							`stock movement it posted stands for that variant, bin and lot; reverse the receipt and record the right ` +
							`line instead.`,
						{ goodsReceiptLineId: line.id, fields: moved }
					);
				}
			}
		}

		return super.update(id as any, partialEntity);
	}

	/**
	 * Removes receipt lines, refusing a line of a receipt that is still posted (review R2-10).
	 *
	 * `DELETE /goods-receipt-lines/:id` and `deleteGoodsReceiptLine` reached the inherited removal, so a line of a
	 * `POSTED` receipt went while the movement it wrote and the order line's received counter stayed — the same
	 * defect as removing the receipt, one line at a time. The line is the ledger's explanation for its movement
	 * for as long as its receipt is posted; once the receipt is reversed (`CANCELED`) it may go.
	 *
	 * The read that decides includes retired rows and selects exactly what the removal selects, so a line the
	 * caller cannot see is neither refused nor removed.
	 *
	 * @param criteria The line's identifier, or the conditions that select the lines to remove.
	 * @param options The base class's legacy find options, forwarded.
	 * @returns The result of the removal.
	 * @throws ConflictException with `GOODS_RECEIPT_LINE_NOT_DELETABLE` when a selected line's receipt is `POSTED`.
	 */
	public async delete(criteria: ID | FindOptionsWhere<GoodsReceiptLine>, options?: any): Promise<DeleteResult> {
		const where = {
			...(typeof criteria === 'string' ? { id: criteria } : criteria),
			...this.statementScope()
		} as FindOptionsWhere<GoodsReceiptLine>;

		await this.assertLinesRemovable(await this.typeOrmGoodsReceiptLineRepository.find({ where, withDeleted: true }));

		return super.delete(where, options);
	}

	/**
	 * Withdraws a receipt line by the same rule as `delete` (review R2-10).
	 *
	 * @param id The line to withdraw.
	 * @param rest The find and save options the base method takes.
	 * @returns The withdrawn line.
	 * @throws NotFoundException when the line is not the caller's.
	 * @throws ConflictException with `GOODS_RECEIPT_LINE_NOT_DELETABLE` when its receipt is `POSTED`.
	 */
	public async softRemove(id: ID, ...rest: any[]): Promise<GoodsReceiptLine> {
		const line = await this.typeOrmGoodsReceiptLineRepository.findOne({
			where: { id, ...this.statementScope() } as FindOptionsWhere<GoodsReceiptLine>
		});

		if (!line) {
			throw new NotFoundException(`Goods-receipt line '${id}' could not be found.`);
		}

		await this.assertLinesRemovable([line]);

		return super.softRemove(id, rest[0], rest[1]);
	}

	/**
	 * Refuses lines whose receipt is still posted. A receipt withdrawn before this guard existed is read too: it is
	 * still posted, and its lines still explain their movements.
	 *
	 * @param lines The lines about to be removed or withdrawn.
	 * @throws ConflictException with `GOODS_RECEIPT_LINE_NOT_DELETABLE`.
	 */
	private async assertLinesRemovable(lines: GoodsReceiptLine[]): Promise<void> {
		const receiptIds = [...new Set(lines.map((line) => line.receiptId).filter((id): id is ID => !!id))];

		if (!receiptIds.length) {
			return;
		}

		const posted = new Map(
			(
				(await this.typeOrmGoodsReceiptLineRepository.manager.find(GoodsReceipt, {
					where: { id: In(receiptIds), status: GoodsReceiptStatus.POSTED } as never,
					withDeleted: true
				})) as GoodsReceipt[]
			).map((receipt) => [receipt.id, receipt])
		);

		for (const line of lines) {
			const receipt = line.receiptId ? posted.get(line.receiptId) : undefined;

			if (receipt) {
				throw new ConflictException({
					message: `GOODS_RECEIPT_LINE_NOT_DELETABLE: goods receipt line '${line.id}' belongs to POSTED receipt '${receipt.number ?? receipt.id}', so the stock movement it wrote and its order line's received quantity still stand; reverse the receipt (POST /goods-receipts/:id/cancel) before removing its lines.`,
					code: 'GOODS_RECEIPT_LINE_NOT_DELETABLE',
					details: {
						goodsReceiptLineId: line.id,
						goodsReceiptId: receipt.id,
						status: receipt.status,
						deletableFrom: [GoodsReceiptStatus.CANCELED]
					}
				});
			}
		}
	}

	/** The caller's tenant and organization, as the statements of this service state them. */
	private statementScope(): Record<string, unknown> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return {
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};
	}

	/**
	 * Reads the lines of a receipt, scoped to the caller's tenant and organization.
	 *
	 * @param receiptId The receipt to read.
	 * @returns The lines, oldest first.
	 */
	public async findForReceipt(receiptId: ID): Promise<GoodsReceiptLine[]> {
		return await this.typeOrmGoodsReceiptLineRepository.find({
			where: {
				receiptId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { createdAt: 'ASC' }
		});
	}

	/**
	 * Writes the lines of a receipt.
	 *
	 * **Inside a caller's transaction the lines are written on it**, so they commit with the receipt
	 * header, the order lines' counters and the stock movements they explain, or not at all. The graph
	 * guard `create()` runs is run here too, against the caller's tenant, so writing through the
	 * transaction does not skip it.
	 *
	 * @param receiptId The receipt being written.
	 * @param inputs The lines that arrived.
	 * @param tenancy The receipt's tenant and organization; the caller's when omitted.
	 * @param manager The caller's open transaction, when the lines belong to it.
	 * @returns The written lines, in the order they were supplied.
	 */
	public async writeLines(
		receiptId: ID,
		inputs: IGoodsReceiptLineWrite[],
		tenancy: { tenantId?: ID; organizationId?: ID } = {},
		manager?: EntityManager
	): Promise<GoodsReceiptLine[]> {
		const lines: GoodsReceiptLine[] = [];

		if (manager) {
			const rows = inputs.map((input) => ({
				receiptId,
				purchaseOrderLineId: input.purchaseOrderLineId,
				variantId: input.variantId,
				quantity: input.quantity,
				damagedQuantity: input.damagedQuantity,
				unitCost: input.unitCost,
				batchNumber: input.batchNumber,
				expiresAt: input.expiresAt,
				warehouseBinId: input.warehouseBinId,
				note: input.note,
				tenantId: tenancy.tenantId ?? RequestContext.currentTenantId(),
				organizationId: tenancy.organizationId ?? RequestContext.currentOrganizationId()
			}));

			await this.assertNestedGraphNotForeign(rows as never, RequestContext.currentTenantId());

			for (const row of rows) {
				lines.push(
					(await manager.save(GoodsReceiptLine, manager.create(GoodsReceiptLine, row as never))) as GoodsReceiptLine
				);
			}

			return lines;
		}

		for (const input of inputs) {
			lines.push(
				await super.create({
					receiptId,
					purchaseOrderLineId: input.purchaseOrderLineId,
					variantId: input.variantId,
					quantity: input.quantity,
					damagedQuantity: input.damagedQuantity,
					unitCost: input.unitCost,
					batchNumber: input.batchNumber,
					expiresAt: input.expiresAt,
					warehouseBinId: input.warehouseBinId,
					note: input.note,
					// **The tenancy is the header's, and it has to be stated.** `TenantAwareCrudService.create` stamps the
					// tenant from the request and states no organization at all, so a receipt line written without one carried
					// `organizationId = NULL` while every read of these lines filters by the caller's organization — the
					// rows were invisible to the service that wrote them (the returns package's item 32, found by its
					// receipt run). The header's tenancy is passed down; the caller's is the fallback, which is the
					// organization the header itself was written in.
					tenantId: tenancy.tenantId ?? RequestContext.currentTenantId(),
					organizationId: tenancy.organizationId ?? RequestContext.currentOrganizationId()
				} as any)
			);
		}

		return lines;
	}

	/**
	 * Records the movement a line produced.
	 *
	 * Set once, in the same operation that wrote the line: it is what makes a receipt traceable to the
	 * ledger in both directions, and what makes a replayed receipt detectable.
	 *
	 * @param lineId The receipt line.
	 * @param stockMovementId The movement the ledger wrote for its good units.
	 * @param manager The caller's open transaction, when the line was written on it.
	 * @returns The updated line.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async stampMovement(lineId: ID, stockMovementId: ID, manager?: EntityManager): Promise<GoodsReceiptLine> {
		const where = {
			id: lineId,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
		const line = manager
			? ((await manager.findOne(GoodsReceiptLine, { where: where as never })) as GoodsReceiptLine | null)
			: await this.typeOrmGoodsReceiptLineRepository.findOne({ where });

		if (!line) {
			throw new NotFoundException(`Goods-receipt line '${lineId}' could not be found.`);
		}

		line.stockMovementId = stockMovementId;

		return manager
			? ((await manager.save(GoodsReceiptLine, line)) as GoodsReceiptLine)
			: await this.typeOrmGoodsReceiptLineRepository.save(line);
	}

	/**
	 * Reads every receipt line written against one order line, which is how "what has this line
	 * actually received" is answered from the ledger's side rather than from the counter.
	 *
	 * @param purchaseOrderLineId The order line.
	 * @returns The receipt lines, oldest first.
	 */
	public async findByPurchaseOrderLine(purchaseOrderLineId: ID): Promise<GoodsReceiptLine[]> {
		return await this.typeOrmGoodsReceiptLineRepository.find({
			where: {
				purchaseOrderLineId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { createdAt: 'ASC' }
		});
	}
}
