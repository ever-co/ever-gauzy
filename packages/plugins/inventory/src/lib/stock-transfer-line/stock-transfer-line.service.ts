import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { StockTransferStatus } from './../inventory.enums';
import { StockTransfer } from './../stock-transfer/stock-transfer.entity';
import { StockTransferLine } from './stock-transfer-line.entity';
import { TypeOrmStockTransferLineRepository } from './repository/type-orm-stock-transfer-line.repository';
import { MikroOrmStockTransferLineRepository } from './repository/mikro-orm-stock-transfer-line.repository';

/**
 * Maintains the lines of a transfer.
 *
 * The quantities that describe what actually moved are written by the transfer’s own ship and
 * receive transitions, never here: a line edited by hand would let the document and the ledger
 * disagree about what left the building.
 */
@Injectable()
export class StockTransferLineService extends TenantAwareCrudService<StockTransferLine> {
	constructor(
		readonly typeOrmStockTransferLineRepository: TypeOrmStockTransferLineRepository,
		readonly mikroOrmStockTransferLineRepository: MikroOrmStockTransferLineRepository
	) {
		super(typeOrmStockTransferLineRepository, mikroOrmStockTransferLineRepository);
	}

	/** Lists the lines of a transfer. */
	public async findLines(filter?: FindManyOptions<StockTransferLine>): Promise<IPagination<StockTransferLine>> {
		return await this.paginate(filter ?? {});
	}

	/**
	 * Adds a line to a draft transfer.
	 *
	 * A line may only be added while the document is a draft: once it has been requested, the set of
	 * things being moved is what was approved.
	 */
	public async addLine(input: {
		transferId: ID;
		variantId: ID;
		requestedQuantity: number;
		unitCost?: number;
		note?: string;
	}): Promise<StockTransferLine> {
		return await this.typeOrmStockTransferLineRepository.manager.transaction(async (manager) => {
			const transfer = await manager.findOne(StockTransfer, { where: { id: input.transferId } });
			if (!transfer) {
				throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The transfer does not exist.', {
					notFound: true,
					details: { transferId: input.transferId }
				});
			}
			if (transfer.status !== StockTransferStatus.DRAFT) {
				throw inventoryError(
					InventoryErrorCode.TRANSFER_ILLEGAL_TRANSITION,
					'Lines may only be added while the transfer is a draft.',
					{ details: { transferId: transfer.id, status: transfer.status } }
				);
			}

			const existing = await manager.findOne(StockTransferLine, {
				where: { transferId: transfer.id, variantId: input.variantId }
			});
			if (existing) {
				existing.requestedQuantity = Number(existing.requestedQuantity) + Number(input.requestedQuantity);
				return await manager.save(StockTransferLine, existing);
			}

			const line = manager.create(StockTransferLine, {
				transferId: transfer.id,
				variantId: input.variantId,
				requestedQuantity: input.requestedQuantity,
				shippedQuantity: 0,
				receivedQuantity: 0,
				damagedQuantity: 0,
				unitCost: input.unitCost,
				note: input.note,
				tenantId: transfer.tenantId,
				organizationId: transfer.organizationId
			} as Partial<StockTransferLine>);
			return await manager.save(StockTransferLine, line);
		});
	}
}
