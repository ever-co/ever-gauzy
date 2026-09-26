import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmExchangeRateRepository } from './repository/mikro-orm-exchange-rate.repository';

/**
 * The conversion between two currencies, valid from an instant.
 *
 * A rate is a fact about a moment, not about a pair: the row in force at an instant is the one with
 * the greatest `validFrom` at or before it whose `validUntil` is null or later. That is why the
 * business key includes `validFrom` — re-quoting the same pair on the same day updates the row,
 * while quoting it for a later day adds one and leaves history intact.
 *
 * The scale is ten decimals rather than the six a money column carries: a cross rate through a weak
 * base currency loses precision at six, and the loss compounds when a cart is converted twice.
 *
 * A rate that is missing is an explicit refusal, never an implicit one-to-one conversion — a
 * silent 1:1 is how a foreign-currency order is charged the wrong amount without anybody noticing.
 */
@ColumnIndex('UQ_exchange_rate', ['organizationId', 'fromCurrency', 'toCurrency', 'validFrom'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex(
	'IDX_exchange_rate_lookup',
	['organizationId', 'fromCurrency', 'toCurrency', 'validFrom', 'validUntil'],
	{ where: '"deletedAt" IS NULL' }
)
@MultiORMEntity('exchange_rate', { mikroOrmRepository: () => MikroOrmExchangeRateRepository })
export class ExchangeRate extends TenantOrganizationBaseEntity {
	/**
	 * Currency being converted from.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	fromCurrency: CurrencyCode;

	/**
	 * Currency being converted to. The pair must be two different currencies: a row converting a
	 * currency into itself is a mistake, and the migration refuses it at the database.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	toCurrency: CurrencyCode;

	/**
	 * Units of `toCurrency` one unit of `fromCurrency` buys.
	 *
	 * Read through the platform numeric transformer, so the property carries the exact decimal the
	 * money layer works in while the value handed back may be the number that transformer parsed;
	 * `Money` accepts either form and is the only thing that should multiply by it.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 10, transformer: new ColumnNumericTransformerPipe() })
	rate: DecimalString;

	/**
	 * Where the rate came from. Null means it was entered by hand, which is also what makes a
	 * provider sync leave it alone.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	providerKey?: string;

	/**
	 * Instant the rate became valid. Mandatory: a rate with no start has no defined moment to be in
	 * force at.
	 */
	@ApiProperty({ type: () => Date })
	@IsDateString()
	@MultiORMColumn({ })
	validFrom: Date;

	/**
	 * Instant the rate stopped being valid; null is open. A closed window is how a historical
	 * conversion stays reproducible after the rate changes.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	validUntil?: Date;

	/**
	 * Whether the row was entered by hand. A manual rate is never overwritten by the next provider
	 * sync, which is what makes a negotiated rate survive the nightly job.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isManual: boolean;
}
