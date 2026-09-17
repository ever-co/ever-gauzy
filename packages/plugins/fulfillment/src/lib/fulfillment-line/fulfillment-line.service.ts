import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { FulfillmentLine } from './fulfillment-line.entity';
import { TypeOrmFulfillmentLineRepository } from './repository/type-orm-fulfillment-line.repository';
import { MikroOrmFulfillmentLineRepository } from './repository/mikro-orm-fulfillment-line.repository';
import { TenantAwareCrudService } from '@gauzy/core';
import { isPositiveQuantity } from '../fulfillment.quantity';

/**
 * What is in a shipment.
 *
 * One row per shipment and order line, which is the shape that makes partial fulfilment unambiguous: a
 * second partial shipment is a second fulfilment, so a picking list never has to answer "which of these
 * two rows of the same line is the one I am picking?".
 *
 * The counters this row feeds live on the order line and are moved by the fulfilment service, so that
 * the shipment and its counters are always written together rather than by two callers who could
 * disagree.
 */
@Injectable()
export class FulfillmentLineService extends TenantAwareCrudService<FulfillmentLine> {
	constructor(
		readonly typeOrmFulfillmentLineRepository: TypeOrmFulfillmentLineRepository,
		readonly mikroOrmFulfillmentLineRepository: MikroOrmFulfillmentLineRepository
	) {
		super(typeOrmFulfillmentLineRepository, mikroOrmFulfillmentLineRepository);
	}

	/**
	 * Creates a line, refusing a non-positive quantity or a second row for the same order line.
	 *
	 * The quantity is read as a quantity rather than compared as one: a value that is not a number at
	 * all is refused here, not waved through by a comparison that is false for it.
	 *
	 * @param entity The line to create.
	 * @returns The created line.
	 */
	public async create(entity: DeepPartial<FulfillmentLine>): Promise<FulfillmentLine> {
		if (!isPositiveQuantity(entity.quantity)) {
			throw new BadRequestException({
				message: 'A fulfilment line quantity must be positive.',
				code: 'FULFILLMENT_LINE_QUANTITY_INVALID',
				details: { quantity: entity.quantity }
			});
		}

		const existing = await this.findAll({
			where: { fulfillmentId: entity.fulfillmentId as string, orderLineId: entity.orderLineId as string }
		});

		if (existing.items.length > 0) {
			throw new BadRequestException({
				message:
					'This order line is already in this fulfilment; a further partial shipment is a second fulfilment.',
				code: 'FULFILLMENT_LINE_DUPLICATE',
				details: { orderLineId: entity.orderLineId, fulfillmentId: entity.fulfillmentId }
			});
		}

		return super.create(entity);
	}
}
