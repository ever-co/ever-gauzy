import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ID, IFulfillmentLine } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { MikroOrmFulfillmentLineRepository } from './repository/mikro-orm-fulfillment-line.repository';

/**
 * What is in one shipment.
 *
 * The pivot that makes partial fulfilment expressible: one row per `(fulfillment, order line)`, so a
 * second partial shipment of the same line is a second fulfilment rather than a second row here — which
 * is what keeps a picking list unambiguous.
 *
 * Writing or changing a row updates the order line's `fulfilledQuantity`, `shippedQuantity` and
 * `deliveredQuantity` in the same transaction. Those counters are what the order's materialised
 * `fulfillmentStatus` is derived from, so the shipment and the order can never disagree about how much
 * of a line has gone out.
 */
@MultiORMEntity('fulfillment_line', { mikroOrmRepository: () => MikroOrmFulfillmentLineRepository })
export class FulfillmentLine extends TenantOrganizationBaseEntity implements IFulfillmentLine {
	/** The shipment. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	fulfillmentId: ID;

	/** The order line being shipped. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	orderLineId: ID;

	/** The quantity in this shipment. Always positive. */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	quantity: number;

	/**
	 * The location this quantity came from. It may differ from the header's, which is what makes a
	 * shipment spanning several locations expressible.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	warehouseId?: ID;

	/** Open-ended payload: the picked bin, the short-pick note, the serial numbers. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The shipment. */
	@MultiORMManyToOne(() => Fulfillment, (it) => it.lines, { onDelete: 'CASCADE' })
	@JoinColumn()
	fulfillment?: Fulfillment;
}
