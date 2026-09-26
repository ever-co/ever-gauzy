import { ICurrency, MoneySymbolPosition, RoundingMode } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmCurrencyRepository } from './repository/mikro-orm-currency.repository';

/**
 * The currency master, extended with the properties the money layer has to know.
 *
 * It stays a global lookup: a currency's decimal places, symbol and rounding mode are properties of
 * the currency, not of a tenant, so this table keeps the base class it already had and gains no
 * tenancy column. `isActive` is already inherited and is therefore not repeated — deactivating a
 * currency is how an operator retires it.
 */
@ColumnIndex('IDX_currency_active_decimal', ['isActive', 'decimalPlaces'])
@ColumnIndex('IDX_currency_active_tender', ['isActive', 'isTender'])
@MultiORMEntity('currency', { mikroOrmRepository: () => MikroOrmCurrencyRepository })
export class Currency extends BaseEntity implements ICurrency {
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: false })
	isoCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: false })
	currency: string;

	/**
	 * Minor-unit exponent used by the rounding strategy and reported as `currencyDecimals` on a cart or
	 * an order. The built-in table of zero-decimal and three-decimal currencies is the fallback for a
	 * code this row has not been told about.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 2 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 2 })
	decimalPlaces?: number;

	/**
	 * Display symbol, read when a value is rendered with its symbol.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 8 })
	@IsOptional()
	@IsString()
	@MaxLength(8)
	@MultiORMColumn({ type: 'varchar', length: 8, nullable: true })
	symbol?: string;

	/**
	 * Whether the symbol precedes or follows the amount. The value set is the money layer's own, so no
	 * second vocabulary exists for one formatting question.
	 */
	@ApiPropertyOptional({ type: () => String, enum: MoneySymbolPosition, default: MoneySymbolPosition.PREFIX })
	@IsEnum(MoneySymbolPosition)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: MoneySymbolPosition,
		default: MoneySymbolPosition.PREFIX
	})
	symbolPosition?: MoneySymbolPosition;

	/**
	 * Space between the symbol and the amount, for the currencies that are written with one.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	symbolSpace?: boolean;

	/**
	 * Per-currency rounding mode consumed by the rounding strategy. `NONE` makes a value that is not
	 * exact at the currency's scale an error rather than a silent truncation.
	 */
	@ApiPropertyOptional({ type: () => String, enum: RoundingMode, default: RoundingMode.HALF_UP })
	@IsEnum(RoundingMode)
	@MultiORMColumn({ type: 'simple-enum', enum: RoundingMode, default: RoundingMode.HALF_UP })
	roundingMode?: RoundingMode;

	/**
	 * Cash-rounding step applied only at the payment boundary; `0` disables it.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	roundingIncrement?: number;

	/**
	 * False for unit-of-account and metal codes, which can never be a cart or an order currency.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isTender?: boolean;
}
