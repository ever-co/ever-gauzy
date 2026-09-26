import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { MikroOrmChannelWarehouseRepository } from './repository/mikro-orm-channel-warehouse.repository';

/**
 * Enables one stock location for one sales context.
 *
 * A pivot rather than a column on either side, because one location serves many contexts and one
 * context draws on many locations. The asymmetry the pair expresses is deliberate: a context with no
 * rows at all may draw on every location, and the moment it has one row it is restricted to the
 * locations it names. That is what makes the table opt-in — an installation that never assigns a
 * location keeps working exactly as it did.
 */
@MultiORMEntity('channel_warehouse', { mikroOrmRepository: () => MikroOrmChannelWarehouseRepository })
export class ChannelWarehouse extends TenantOrganizationBaseEntity {
	/**
	 * Whether the context prefers this location when more than one is eligible.
	 *
	 * At most one assignment per context may carry it; the database expresses the rule as a partial
	 * unique index on the dialects that support one, and the service states it on all of them.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isDefault: boolean;

	/**
	 * Allocation preference among the context’s locations. Higher wins; ties fall through to the
	 * remaining criteria of the strategy.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, any>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Location enabled for the context.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	warehouse?: Warehouse;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ChannelWarehouse) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	warehouseId: ID;

	/**
	 * Sales context the location is enabled for.
	 *
	 * Declared as a plain identifier rather than a relation: the sales-context table is created by the
	 * kernel migration set, which runs before this one, so the column carries its foreign key in the
	 * database while the entity stays free of a dependency on a package that may not be installed.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	channelId: ID;
}
