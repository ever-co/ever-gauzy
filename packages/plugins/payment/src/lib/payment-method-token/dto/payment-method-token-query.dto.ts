import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested
} from 'class-validator';
import { PaymentMethodTokenStatus, PaymentMethodTokenType } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';

/**
 * The narrowing members of the instrument list, as the endpoint catalogue states them.
 *
 * `contactId` and `accountHolderId` are two spellings of "whose instruments", and the service resolves
 * the first into the second: a party's saved instruments are those of every account it holds at a
 * provider, so filtering by the party is a read of the account table followed by one of this one.
 */
export class PaymentMethodTokenFilterDTO {
	/**
	 * Restrict to the instruments of one party's accounts.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly contactId?: string;

	/**
	 * Restrict to the instruments of one account at a provider.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly accountHolderId?: string;

	/**
	 * Restrict to the instruments of one provider key.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly providerKey?: string;

	/**
	 * Restrict to one kind of instrument.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodTokenType })
	@IsOptional()
	@IsEnum(PaymentMethodTokenType)
	readonly type?: PaymentMethodTokenType;

	/**
	 * Restrict to one lifecycle status.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodTokenStatus })
	@IsOptional()
	@IsEnum(PaymentMethodTokenStatus)
	readonly status?: PaymentMethodTokenStatus;

	/**
	 * Restrict to the default instrument of its account and kind, or to the ones that are not.
	 *
	 * A query string carries text, so the value is parsed with the platform's own boolean reader:
	 * `?isDefault=false` is a question about the instruments that are **not** the default, and a plain
	 * cast would read the word "false" as true and answer the opposite question.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isDefault?: boolean;
}

/**
 * The query of `GET /payment-method-tokens`.
 *
 * Both spellings of the same filter are accepted, for the reason the account list accepts both: the
 * flat one is how this package's delivered list routes are called, and the bracketed one
 * (`?filter[accountHolderId]=…`) is the query protocol the endpoint table names for this resource.
 */
export class PaymentMethodTokenQueryDTO extends PaymentMethodTokenFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => PaymentMethodTokenFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => PaymentMethodTokenFilterDTO)
	readonly filter?: PaymentMethodTokenFilterDTO;

	/**
	 * How many instruments to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	readonly take?: number;

	/**
	 * How many instruments to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
