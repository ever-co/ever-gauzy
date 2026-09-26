import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsString, MaxLength } from 'class-validator';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { PricePreferenceAttribute } from '../pricing.types';
import { MikroOrmPricePreferenceRepository } from './repository/mikro-orm-price-preference.repository';

/**
 * How one scope presents prices.
 *
 * A price preference answers a single question — "should this price be shown with tax?" — for a
 * currency, a region or a channel, and nothing else. It exists because the same catalogue is
 * presented tax-inclusive in one country and tax-exclusive in another while the price rows
 * underneath are shared, so the answer cannot live on the price.
 *
 * It is the third answer in the precedence chain, after a price row's own `taxInclusive` and its
 * price list's: a more specific declaration always beats a broader one, and this table is what a
 * merchant configures when neither of the two more specific places says anything.
 *
 * One row per `(organization, attribute, value)`: two answers for one scope would make a displayed
 * price depend on row order.
 */
@ColumnIndex('UQ_price_preference', ['organizationId', 'attribute', 'value'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@MultiORMEntity('price_preference', { mikroOrmRepository: () => MikroOrmPricePreferenceRepository })
export class PricePreference extends TenantOrganizationBaseEntity {
	/**
	 * What the preference is keyed by: a currency, a region or a channel.
	 *
	 * The column has no default on purpose. A preference that defaulted to `CURRENCY` would silently
	 * answer for a scope the operator never chose, and the whole point of the row is to state a
	 * scope explicitly.
	 */
	@ApiProperty({ type: () => String, enum: PricePreferenceAttribute })
	@IsEnum(PricePreferenceAttribute)
	@MultiORMColumn({ type: 'simple-enum', enum: PricePreferenceAttribute })
	attribute: PricePreferenceAttribute;

	/**
	 * The attribute's value: an ISO 4217 currency code (`USD`), a region id or region code, or a
	 * channel code. Held as text because the three scopes address their targets differently and a
	 * preference must survive a region being re-created.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	value: string;

	/**
	 * Whether prices in this scope are presented tax-inclusive.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;
}
