import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsBoolean, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID, IWarehouse } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { IOrderClaim, IOrderExchange, IOrderReturn, IOrderReturnLine, IOrderReturnReason, OrderReturnStatus } from '../returns.types';
import { OrderClaim } from '../order-claim/order-claim.entity';
import { OrderExchange } from '../order-exchange/order-exchange.entity';
import { OrderReturnLine } from '../order-return-line/order-return-line.entity';
import { OrderReturnReason } from '../order-return-reason/order-return-reason.entity';
import { MikroOrmOrderReturnRepository } from './repository/mikro-orm-order-return.repository';

/**
 * Goods coming back, and the money that may go out with them.
 *
 * The header carries the lifecycle and the two things a return is worth: how much is expected back
 * (`refundAmount`) and where the goods land (`warehouseId`). What may come back is decided line by
 * line in `OrderReturnLine`, and the ceiling is what was actually fulfilled on the order — a return
 * can never ask for more than the customer received, and the sum of every live return on one order
 * line can never exceed it either.
 *
 * Only the refund is money here, and even that is an expectation: the refund rows themselves belong
 * to the payment domain, which is why `refundAmount` and the settled refunds are separate facts.
 */
@MultiORMEntity('order_return', { mikroOrmRepository: () => MikroOrmOrderReturnRepository })
export class OrderReturn extends TenantOrganizationBaseEntity implements IOrderReturn {
	/**
	 * The order the goods came from.
	 *
	 * Declared as a plain relation id: the order belongs to the order domain, which this plugin reads
	 * through the platform service layer rather than by mapping another domain's entity. The foreign
	 * key is created by this plugin's migration.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/**
	 * Human-readable return number, allocated from the `RETURN` series so a customer can quote it.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	number: string;

	/**
	 * Where the return is in its lifecycle.
	 */
	@ApiProperty({ type: () => String, enum: OrderReturnStatus })
	@IsEnum(OrderReturnStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: OrderReturnStatus.OPEN })
	status: OrderReturnStatus;

	/**
	 * Free-text explanation kept beside the governed reason.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	reason?: string;

	/**
	 * What the tenant expects to refund. The refunds actually issued are rows in the payment domain.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	refundAmount?: DecimalString;

	/**
	 * Currency every amount on this return is expressed in.
	 */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Suppress customer notifications for this return; used by bulk imports and by corrections.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	noNotification: boolean;

	/**
	 * Operator note.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * Open-ended extras: the carrier's return label id, an inspection outcome, an import's provenance.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Lifecycle timestamps
	|--------------------------------------------------------------------------
	*/

	/** When the customer asked to return. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	requestedAt?: Date;

	/** When the tenant accepted the request. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	approvedAt?: Date;

	/** When the goods were physically received. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	receivedAt?: Date;

	/** When either side withdrew the return. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** When the return was settled and closed. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	closedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Receiving location: where the goods are expected to land.
	 */
	@ApiPropertyOptional({ type: () => Warehouse })
	@IsOptional()
	@MultiORMManyToOne(() => Warehouse, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	warehouse?: IWarehouse;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderReturn) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseId?: ID;

	/**
	 * The governed reason this return was filed under.
	 *
	 * The property carries the trailing underscore the specification gives it, because the free-text
	 * `reason` column above already owns the plain name and the two answer different questions. The
	 * join column is named explicitly so the database column is `reasonId` in both ORMs.
	 */
	@ApiPropertyOptional({ type: () => OrderReturnReason })
	@IsOptional()
	@MultiORMManyToOne(() => OrderReturnReason, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Column the relation is stored in; named explicitly because the property is qualified. */
		joinColumn: 'reasonId'
	})
	@JoinColumn({ name: 'reasonId' })
	reason_?: IOrderReturnReason;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderReturn) => it.reason_)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	reasonId?: ID;

	/**
	 * The claim this return was created by, when it was.
	 */
	@ApiPropertyOptional({ type: () => OrderClaim })
	@IsOptional()
	@MultiORMManyToOne(() => OrderClaim, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	claim?: IOrderClaim;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderReturn) => it.claim)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	claimId?: ID;

	/**
	 * The exchange this return is the inbound half of, when it is.
	 */
	@ApiPropertyOptional({ type: () => OrderExchange })
	@IsOptional()
	@MultiORMManyToOne(() => OrderExchange, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	exchange?: IOrderExchange;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrderReturn) => it.exchange)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	exchangeId?: ID;

	/**
	 * Shipping option used for the return leg. Declared as a plain relation id: the option belongs to
	 * the fulfilment domain, and this plugin's migration creates the foreign key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	shippingOptionId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * What is coming back.
	 */
	@ApiPropertyOptional({ type: () => OrderReturnLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => OrderReturnLine, (it) => it.return, {
		cascade: true
	})
	lines?: IOrderReturnLine[];
}
