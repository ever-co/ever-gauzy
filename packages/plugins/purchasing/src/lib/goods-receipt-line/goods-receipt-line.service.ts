import { Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { GoodsReceiptLine } from './goods-receipt-line.entity';
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
export class GoodsReceiptLineService extends TenantAwareCrudService<GoodsReceiptLine> {
	constructor(
		readonly typeOrmGoodsReceiptLineRepository: TypeOrmGoodsReceiptLineRepository,
		readonly mikroOrmGoodsReceiptLineRepository: MikroOrmGoodsReceiptLineRepository
	) {
		super(typeOrmGoodsReceiptLineRepository, mikroOrmGoodsReceiptLineRepository);
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
	 * @param receiptId The receipt being written.
	 * @param inputs The lines that arrived.
	 * @returns The written lines, in the order they were supplied.
	 */
	public async writeLines(receiptId: ID, inputs: IGoodsReceiptLineWrite[]): Promise<GoodsReceiptLine[]> {
		const lines: GoodsReceiptLine[] = [];

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
					note: input.note
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
	 * @returns The updated line.
	 * @throws NotFoundException when the line is not the caller's.
	 */
	public async stampMovement(lineId: ID, stockMovementId: ID): Promise<GoodsReceiptLine> {
		const line = await this.typeOrmGoodsReceiptLineRepository.findOne({
			where: {
				id: lineId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		});

		if (!line) {
			throw new NotFoundException(`Goods-receipt line '${lineId}' could not be found.`);
		}

		line.stockMovementId = stockMovementId;

		return await this.typeOrmGoodsReceiptLineRepository.save(line);
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
