import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DeepPartial, DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID } from '@gauzy/contracts';
import { FulfillmentLine } from './fulfillment-line.entity';
import { TypeOrmFulfillmentLineRepository } from './repository/type-orm-fulfillment-line.repository';
import { MikroOrmFulfillmentLineRepository } from './repository/mikro-orm-fulfillment-line.repository';
import { TenantAwareCrudService, compareDecimalStrings } from '@gauzy/core';
import { Quantity, isPositiveQuantity, toQuantityText } from '../fulfillment.quantity';
import { isCountedShipment, removalCriteria } from '../fulfillment.removal';

/**
 * The columns of a line the order line's counters were derived from.
 *
 * Which shipment the units are in, which order line they satisfy and how many they are: the shipment
 * service moved `fulfilledQuantity` — and later `shippedQuantity` and `deliveredQuantity` — by exactly
 * these, so a line whose values moved afterwards would leave the counters describing a shipment that no
 * longer exists.
 */
const COUNTED_LINE_COLUMNS = ['fulfillmentId', 'orderLineId', 'quantity'] as const;

/** One of the columns above. */
type CountedLineColumn = (typeof COUNTED_LINE_COLUMNS)[number];

/**
 * What is in a shipment.
 *
 * One row per shipment and order line, which is the shape that makes partial fulfilment unambiguous: a
 * second partial shipment is a second fulfilment, so a picking list never has to answer "which of these
 * two rows of the same line is the one I am picking?".
 *
 * The counters this row feeds live on the order line and are moved by the fulfilment service, so that
 * the shipment and its counters are always written together rather than by two callers who could
 * disagree. That is also why the two writes this service serves on its own — the line's correction and
 * its removal, `PUT` and `DELETE /fulfillment-lines/:id` and the `updateFulfillmentLine` and
 * `deleteFulfillmentLine` fields — refuse to move what the counters were derived from: neither can give
 * the counters back, so a correction may not re-point or re-size a line, and a removal may not take a
 * line of a shipment the counters still count. Both refusals are made here, below both surfaces, so the
 * two protocols cannot differ about them.
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

	/**
	 * Corrects a line, refusing a change to what the order line's counters were derived from.
	 *
	 * The correction is the repair surface for what a line *says* — the location the units came from and
	 * the payload a picker wrote on it (`warehouseId`, `metadata`). It is not a way to move the units: the
	 * shipment service moved the order line's counters by this line's shipment, order line and quantity when
	 * the shipment was created, and nothing on this path moves them again. A correction that changed one of
	 * the three used to be written as asked — over `PUT /fulfillment-lines/:id` and `updateFulfillmentLine`
	 * alike — and left the counters describing the line as it was: a quantity cut from 5 to 1 still counted
	 * 5, and a line re-pointed at another order line counted against the first one for good. A shipment
	 * whose contents are wrong is cancelled, which gives its units back, and shipped again.
	 *
	 * A member that restates the value the row already holds is not a change and is accepted, so a client
	 * that sends the whole row back with one payload member edited is not refused for the members it did
	 * not touch. Quantities are compared as the exact decimals they are, so `2` and `'2.000000'` agree.
	 *
	 * @param id The line, or the conditions that select the lines to correct.
	 * @param partialEntity The fields to change.
	 * @returns The update result, as the base class answers it.
	 * @throws BadRequestException with `FULFILLMENT_LINE_IMMUTABLE` when the correction would move the
	 * shipment, the order line or the quantity of a line.
	 */
	public async update(
		id: ID | FindOptionsWhere<FulfillmentLine>,
		partialEntity: QueryDeepPartialEntity<FulfillmentLine>
	): Promise<FulfillmentLine | UpdateResult> {
		const patch = (partialEntity ?? {}) as Record<string, unknown>;
		const stated = COUNTED_LINE_COLUMNS.filter((column) => patch[column] !== undefined);

		if (stated.length > 0) {
			const current =
				typeof id === 'string' ? [await this.findOneByIdString(id)] : await this.find({ where: id });

			for (const line of current) {
				const moved = stated.filter((column) => !this.restates(column, line[column], patch[column]));

				if (moved.length > 0) {
					throw new BadRequestException({
						message: `FULFILLMENT_LINE_IMMUTABLE: a correction cannot change ${moved.join(', ')} of fulfilment line '${line.id}', because the order line's counters were moved by them; cancel the shipment and ship it again instead.`,
						code: 'FULFILLMENT_LINE_IMMUTABLE',
						details: { fulfillmentLineId: line.id, columns: moved }
					});
				}
			}
		}

		return super.update(id, partialEntity);
	}

	/**
	 * Removes a line outright, unless the shipment it belongs to is still counted.
	 *
	 * The line is what the order line's counters were summed from, and removing it gives nothing back:
	 * `DELETE /fulfillment-lines/:id` and `deleteFulfillmentLine` used to drop the row of a pending shipment
	 * and leave `fulfilledQuantity` counting its units, so the remainder they left was never shipped and
	 * never shippable. A line of a shipment the counters still count (`isCountedShipment`) is therefore
	 * refused, and the refusal names the way out: cancelling the shipment gives the units back, after which
	 * its lines may go. A line of a return leg moved no counter and may go at any time.
	 *
	 * The shipment is read with the line, retired rows included — a soft-deleted shipment is still counted —
	 * and a line whose shipment cannot be read is refused rather than guessed about. The read selects exactly
	 * what the removal selects (`removalCriteria`), so a line the caller cannot see is neither refused nor
	 * removed: the statement matches nothing and answers `affected: 0`.
	 *
	 * @param criteria The line's identifier, or the conditions that select the lines to remove.
	 * @returns The result of the removal.
	 * @throws ConflictException with `FULFILLMENT_LINE_NOT_DELETABLE` when a selected line belongs to a
	 * shipment the order line still counts.
	 */
	public async delete(criteria: ID | FindOptionsWhere<FulfillmentLine>): Promise<DeleteResult> {
		const where = removalCriteria(criteria) as FindOptionsWhere<FulfillmentLine>;
		const selected = await this.find({ where, relations: ['fulfillment'], withDeleted: true });

		for (const line of selected) {
			if (isCountedShipment(line.fulfillment)) {
				throw new ConflictException({
					message: `FULFILLMENT_LINE_NOT_DELETABLE: fulfilment line '${line.id}' belongs to a shipment the order line still counts; cancel fulfillment '${line.fulfillmentId}' before removing its lines.`,
					code: 'FULFILLMENT_LINE_NOT_DELETABLE',
					details: {
						fulfillmentLineId: line.id,
						fulfillmentId: line.fulfillmentId,
						status: line.fulfillment?.status ?? null,
						direction: line.fulfillment?.direction ?? null
					}
				});
			}
		}

		return super.delete(where);
	}

	/**
	 * Whether a stated value is the value a counted column already holds.
	 *
	 * @param column The column.
	 * @param stored What the row holds.
	 * @param stated What the correction states.
	 * @returns True when the correction restates the stored value rather than changing it.
	 */
	private restates(column: CountedLineColumn, stored: unknown, stated: unknown): boolean {
		if (column !== 'quantity') {
			return stated !== null && String(stated) === String(stored ?? '');
		}

		try {
			return compareDecimalStrings(toQuantityText(stored as Quantity), toQuantityText(stated as Quantity)) === 0;
		} catch {
			// A value that is not a decimal at all is not the quantity the row holds.
			return false;
		}
	}
}
