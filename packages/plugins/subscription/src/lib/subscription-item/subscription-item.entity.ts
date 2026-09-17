import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { JoinColumn, RelationId } from 'typeorm';
import { ISubscriptionItem } from '../subscription.types';
import { Subscription } from '../subscription/subscription.entity';
import { MikroOrmSubscriptionItemRepository } from './repository/mikro-orm-subscription-item.repository';

/**
 * One recurring line of a subscription: what each cycle bills.
 *
 * The line set is what a cycle's amount is the sum of, so it is the one place a quantity or a price
 * changes. `unitPrice` is snapshotted at subscribe time and re-resolved on each repricing, which is
 * what makes a historical cycle's amount reproducible from the rows that existed when it ran: a
 * later price change must not silently rewrite what a customer was charged last month.
 *
 * One row per `(subscription, variant)` — a second row for the same variant would make "how many of
 * this does the customer get" ambiguous.
 */
@MultiORMEntity('subscription_item', { mikroOrmRepository: () => MikroOrmSubscriptionItemRepository })
export class SubscriptionItem extends TenantOrganizationBaseEntity implements ISubscriptionItem {
	/** How many of the variant each cycle delivers. */
	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 1 })
	quantity: DecimalString;

	/**
	 * Recurring unit price for one cycle, snapshotted when the line was written or last repriced.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "19.990000".' })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	unitPrice: DecimalString;

	/** Position of the line in the subscription, so a listing is stable across reads. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** Open-ended extras: the price list the line was priced from, a per-line note. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The subscription the line belongs to. Cascading, so deleting a subscription removes the lines
	 * that describe it — a line without a subscription bills nobody.
	 */
	@ApiProperty({ type: () => Subscription })
	@MultiORMManyToOne(() => Subscription, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: false,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	subscription?: Subscription;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: SubscriptionItem) => it.subscription)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	subscriptionId: ID;

	/**
	 * The variant the line delivers.
	 *
	 * Declared as a plain identifier rather than as a relation: the variant belongs to the catalogue
	 * capability, and this package reads it through that capability's public surface instead of
	 * mapping another domain's entity. The foreign key is created by this plugin's migration.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	variantId: ID;
}
