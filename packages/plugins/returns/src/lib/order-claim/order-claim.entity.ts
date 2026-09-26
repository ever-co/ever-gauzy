import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IOrderClaim, IOrderClaimLine, IOrderReturn, OrderClaimStatus, OrderClaimType } from '../returns.types';
import { OrderClaimLine } from '../order-claim-line/order-claim-line.entity';
import { OrderReturn } from '../order-return/order-return.entity';
import { MikroOrmOrderClaimRepository } from './repository/mikro-orm-order-claim.repository';

/**
 * A customer assertion that something about a delivered order was wrong, plus the resolution chosen
 * for it.
 *
 * A claim is deliberately not a return with a different label. A missing item is never sent back —
 * there is nothing to send — so a claim can be settled by money alone; a wrong item is settled by a
 * replacement, which needs an outbound shipment and usually a return of the wrong goods; a faulty
 * item is written off rather than restocked. The `type` records which of the two answers the tenant
 * chose, and the lines record what the customer says is wrong.
 */
@MultiORMEntity('order_claim', { mikroOrmRepository: () => MikroOrmOrderClaimRepository })
export class OrderClaim extends TenantOrganizationBaseEntity implements IOrderClaim {
	/**
	 * The order the claim is about.
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
	 * Human-readable claim number, allocated from the `CLAIM` series.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	number: string;

	/**
	 * Which resolution the claim asks for.
	 */
	@ApiProperty({ type: () => String, enum: OrderClaimType })
	@IsEnum(OrderClaimType)
	@MultiORMColumn({ type: 'varchar', length: 16, default: OrderClaimType.REFUND })
	type: OrderClaimType;

	/**
	 * Where the claim is in its lifecycle.
	 */
	@ApiProperty({ type: () => String, enum: OrderClaimStatus })
	@IsEnum(OrderClaimStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: OrderClaimStatus.OPEN })
	status: OrderClaimStatus;

	/**
	 * Amount to be refunded when the resolution is money.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	refundAmount?: DecimalString;

	/**
	 * Currency every amount on this claim is expressed in.
	 */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Free-text explanation kept beside the claim lines.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	reason?: string;

	/**
	 * Operator note.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * When the claim was withdrawn.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/**
	 * Open-ended extras kept beside the claim.
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
	 * The return created for this claim, when the faulty goods have to come back.
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
	@RelationId((it: OrderClaim) => it.return)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	returnId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * What the customer says is wrong, line by line.
	 */
	@ApiPropertyOptional({ type: () => OrderClaimLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => OrderClaimLine, (it) => it.claim, {
		cascade: true
	})
	lines?: IOrderClaimLine[];
}
