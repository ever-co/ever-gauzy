import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { RelationId } from 'typeorm';
import { DecimalString, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { UnitCategory } from './unit-category.entity';
import { MikroOrmUnitRepository } from './repository/mikro-orm-unit.repository';

/**
 * One unit inside a family, with the factor that defines it.
 *
 * `factor` is how many **reference units** one of this unit contains, stored as `numeric(24,12)`.
 * Twelve fractional digits make metric/imperial interop exact — `1 in = 25.4 mm`, `1 lb =
 * 453.59237 g`, `1 oz = 28.349523125 g` — so a factor is never itself rounded, and conversion error
 * comes only from the quantity's own granularity. It is deliberately **not** `numeric(20,6)`: a
 * quantity is rounded to its unit's granularity, a factor never is.
 *
 * Two properties hold together and make the arithmetic safe. `factor >= 1`, because the reference of
 * a family is its smallest unit, so every factor is a multiplier and the integer cases that dominate
 * packaging stay exact. A reference unit's factor is exactly `1`, which is what the second check
 * constraint below states and what makes a category's base quantity unambiguous.
 *
 * A factor is a definition, not a rate: it is a container's meaning, so it is deliberately **not**
 * effective-dated. Redefining a box from 12 to 10 must not restate a shipment that has already
 * happened, and the document line already freezes the factor it was entered with, so the snapshot
 * resolves the question once at write rather than at every read.
 */
@MultiORMEntity('unit', { mikroOrmRepository: () => MikroOrmUnitRepository })
export class Unit extends TenantOrganizationBaseEntity {
	/**
	 * The family this unit belongs to. Conversion is defined only inside one family.
	 */
	@ApiProperty({ type: () => UnitCategory })
	@MultiORMManyToOne(() => UnitCategory, (category) => category.units, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	category?: UnitCategory;

	/**
	 * Id of the family. Indexed, and the leading column of the family's conversion index.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Unit) => it.category)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	categoryId: ID;

	/**
	 * Machine key, unique per organization: `PIECE`, `BOX`, `PALLET`, `GRAM`, `KILOGRAM`,
	 * `MILLIMETRE`, `INCH`, `LITRE`.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32 })
	code: string;

	/**
	 * Display name.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	name: string;

	/**
	 * Display suffix (`kg`, `pc`); null falls back to the code.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	symbol?: string;

	/**
	 * How many reference units one of this unit contains. A multiplier, never below one.
	 *
	 * Read as an exact decimal through the platform's numeric transformer; `QuantityCodec` is the only
	 * thing that should ever do arithmetic with it.
	 */
	@ApiProperty({ type: () => String, default: '1' })
	@MultiORMColumn({
		type: 'numeric',
		precision: 24,
		scale: 12,
		default: 1,
		transformer: new ColumnNumericTransformerPipe()
	})
	factor: DecimalString;

	/**
	 * The one member of the family that defines its base quantity. Exactly one per family.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isReference: boolean;

	/**
	 * Quantity granularity in this unit: how many decimals a quantity expressed in it may carry.
	 *
	 * Tied to the storage type by construction — quantities are `numeric(20,6)`, so a unit claiming
	 * more decimals would be unrepresentable. This is quantity granularity and never money rounding:
	 * money is rounded at `currency.decimalPlaces` by the money layer, a quantity at this column by
	 * `QuantityCodec`, and the two are deliberately separate authorities over separate kinds of
	 * number.
	 */
	@ApiProperty({ type: () => Number, default: 0, minimum: 0, maximum: 6 })
	@IsInt()
	@Min(0)
	@Max(6)
	@MultiORMColumn({ type: 'int', default: 0 })
	decimalPlaces: number;

	/**
	 * A seeded unit: editable, never deletable.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isSystem: boolean;

	/**
	 * Tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
