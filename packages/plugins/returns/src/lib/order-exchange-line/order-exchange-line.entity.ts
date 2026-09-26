import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { DecimalString, ID, IProductVariant } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IOrderExchange, IOrderExchangeLine } from '../returns.types';
import { OrderExchange } from '../order-exchange/order-exchange.entity';
import { MikroOrmOrderExchangeLineRepository } from './repository/mikro-orm-order-exchange-line.repository';

/**
 * One outbound line of an exchange.
 *
 * `unitPrice` is a snapshot of what the replacement was priced at when the exchange was approved, not
 * a value a reader re-resolves later: `differenceDue` was computed from it and the customer was
 * charged or credited that difference, so repricing the variant afterwards must not rewrite history.
 * Writing the lines moves no stock — the reservation happens when the exchange is resolved.
 */
@MultiORMEntity('order_exchange_line', { mikroOrmRepository: () => MikroOrmOrderExchangeLineRepository })
export class OrderExchangeLine extends TenantOrganizationBaseEntity implements IOrderExchangeLine {
	/**
	 * The order line the replacement corresponds to, when it corresponds to one.
	 *
	 * Declared as a plain relation id: the order line belongs to the order domain. This plugin's
	 * migration creates the foreign key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderLineId?: ID;

	/**
	 * Quantity of the replacement variant being shipped out.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantity: DecimalString;

	/**
	 * Resolved price of one replacement unit, snapshotted so `differenceDue` stays explainable.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	unitPrice: DecimalString;

	/**
	 * Operator note for this line.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Open-ended extras kept beside the line.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The exchange this line belongs to.
	 */
	@ApiProperty({ type: () => OrderExchange })
	@IsNotEmpty()
	@MultiORMManyToOne(() => OrderExchange, (it) => it.lines, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	exchange?: IOrderExchange;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrderExchangeLine) => it.exchange)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	exchangeId?: ID;

	/**
	 * The replacement variant. Named by every exchange line and never null: a line that does not say
	 * what is shipped out is not an exchange line.
	 */
	@ApiProperty({ type: () => ProductVariant })
	@IsNotEmpty()
	@MultiORMManyToOne(() => ProductVariant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: false,

		/** Database cascade action on delete. */
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	variant?: IProductVariant;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrderExchangeLine) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId?: ID;
}
