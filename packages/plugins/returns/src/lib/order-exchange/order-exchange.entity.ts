import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IOrderExchange, IOrderExchangeLine, IOrderReturn, OrderExchangeStatus } from '../returns.types';
import { OrderExchangeLine } from '../order-exchange-line/order-exchange-line.entity';
import { OrderReturn } from '../order-return/order-return.entity';
import { MikroOrmOrderExchangeRepository } from './repository/mikro-orm-order-exchange.repository';

/**
 * A return that immediately becomes a new shipment.
 *
 * The two halves are priced against each other and the difference is what the customer owes or is
 * owed, which is why `differenceDue` is a column rather than something a client recomputes: it is
 * the number the payment collection was adjusted by, and it has to stay explicable after the
 * replacement variant is repriced. The inbound half is a real return — the same receiving, restock
 * and write-off rules apply to it — and the outbound half is a real reservation, so an exchange
 * fails and compensates when the replacement is not in stock and backorders are not allowed.
 */
@MultiORMEntity('order_exchange', { mikroOrmRepository: () => MikroOrmOrderExchangeRepository })
export class OrderExchange extends TenantOrganizationBaseEntity implements IOrderExchange {
	/**
	 * The order the exchange was raised against.
	 *
	 * Declared as a plain relation id: the order belongs to the order domain. This plugin's migration
	 * creates the foreign key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/**
	 * Human-readable exchange number, allocated from the `EXCHANGE` series.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	number: string;

	/**
	 * Where the exchange is in its lifecycle.
	 */
	@ApiProperty({ type: () => String, enum: OrderExchangeStatus })
	@IsEnum(OrderExchangeStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: OrderExchangeStatus.OPEN })
	status: OrderExchangeStatus;

	/**
	 * Outbound value minus inbound value: positive when the customer owes money, negative when the
	 * customer is owed.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	differenceDue?: DecimalString;

	/**
	 * Currency every amount on this exchange is expressed in.
	 */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Permit the exchange when the replacement is not in stock. With `false`, insufficient stock fails
	 * the resolution and compensates rather than overselling.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	allowBackorder: boolean;

	/**
	 * Operator note.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * When the exchange was withdrawn.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/**
	 * Open-ended extras kept beside the exchange.
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
	 * The inbound half: the return that brings the original goods back.
	 */
	@ApiPropertyOptional({ type: () => OrderReturn })
	@IsOptional()
	@MultiORMManyToOne(() => OrderReturn, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	return?: IOrderReturn;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderExchange) => it.return)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	returnId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * The outbound half: what the customer receives instead.
	 */
	@ApiPropertyOptional({ type: () => OrderExchangeLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => OrderExchangeLine, (it) => it.exchange, {
		cascade: true
	})
	lines?: IOrderExchangeLine[];
}
