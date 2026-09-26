import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';
import {
	CurrencyCode,
	DecimalString,
	ITaxLine,
	ID,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmTaxLineRepository } from './repository/mikro-orm-tax-line.repository';

/**
 * One rate's contribution to the tax of one owner.
 *
 * The breakdown of a taxed document is rows rather than a single amount so that a compound or
 * multi-jurisdiction tax is fully represented and can be explained line by line: an accountant asks
 * which rate produced which amount on which base, and a column cannot answer that.
 *
 * `name` and `rate` are snapshots taken when the tax was computed. Renaming a rate must not rewrite
 * what an already placed document was charged, and a recomputation rewrites the rows inside the
 * transaction that recomputes them rather than mutating them in place.
 *
 * `taxRateId` is a plain identifier rather than a relation: the rate table is contributed by the tax
 * capability, and the ledger has to be usable by an installation that computes tax through an external
 * engine or from a legacy per-variant rate — which is exactly why the column is nullable and why
 * `providerKey` exists next to it.
 */
@MultiORMEntity('tax_line', { mikroOrmRepository: () => MikroOrmTaxLineRepository })
export class TaxLine extends TenantOrganizationBaseEntity implements ITaxLine {
	/**
	 * What the line is the breakdown of.
	 */
	@ApiProperty({ type: () => String, enum: TaxLineOwnerType })
	@IsEnum(TaxLineOwnerType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: TaxLineOwnerType.CART_LINE })
	ownerType: TaxLineOwnerType;

	/**
	 * Id of the owning row. Polymorphic by design, so it is a plain identifier rather than a relation.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	ownerId: ID;

	/**
	 * The rate row that applied; null when the rate came from an external engine or from a legacy
	 * per-variant value.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	taxRateId?: ID;

	/**
	 * Jurisdiction or rate code, for example `US-CA-SALES`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	code?: string;

	/**
	 * The rate's name at calculation time.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * The rate as a fraction — `0.200000` for twenty percent. A fraction rather than a percentage, so
	 * that a rate is applied by one multiplication and no caller has to remember to divide by a hundred.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	rate: DecimalString;

	/**
	 * Whether the line compounds on the running total of the earlier lines of the same owner.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isCompound: boolean;

	/**
	 * Whether the line's amount is already inside the price, which is what tells a totals writer not to
	 * add it a second time.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isInclusive: boolean;

	/**
	 * The amount the rate was applied to: the owner's net for a plain rate, the net plus every already
	 * rounded preceding tax amount for a compound one.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	baseAmount: DecimalString;

	/**
	 * The resulting tax amount, rounded once at the currency's scale.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: DecimalString;

	/**
	 * Currency of the amounts. Must equal the owner's currency.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * External tax engine that produced the line, when one did.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	providerKey?: string;

	/**
	 * Jurisdiction name, engine request id, exemption reason.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;
}
