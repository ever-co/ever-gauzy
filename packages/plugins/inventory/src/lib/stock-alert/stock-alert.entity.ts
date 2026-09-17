import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { MikroOrmStockAlertRepository } from './repository/mikro-orm-stock-alert.repository';

/**
 * An explicit low-stock rule.
 *
 * The level tables already carry a restock threshold; this table is what turns a threshold into a
 * notification with named recipients and a cooling-off period, which is a different thing from a
 * replenishment parameter and therefore belongs in a row of its own.
 *
 * The inherited `isActive` keeps its row-liveness meaning and doubles as "this rule is enabled",
 * because for an alert rule the two coincide: a disabled rule is one nobody wants evaluated.
 */
@MultiORMEntity('stock_alert', { mikroOrmRepository: () => MikroOrmStockAlertRepository })
export class StockAlert extends TenantOrganizationBaseEntity {
	/**
	 * Availability at or below which the rule fires.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	threshold: number;

	/**
	 * Additional recipients, stored as a comma-separated list.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	notifyEmails?: string[];

	/**
	 * Roles whose members are notified, stored as a comma-separated list.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	notifyRoles?: string[];

	/**
	 * Last time the rule fired.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastTriggeredAt?: Date;

	/**
	 * Minimum gap between two fires, so a fluctuating level does not spam its recipients.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	cooldownMinutes: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Variant the rule watches.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: StockAlert) => it.variant)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	variantId: ID;

	/**
	 * Location the rule watches; null means it watches the sum across every location.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	warehouse?: Warehouse;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: StockAlert) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseId?: ID;
}
