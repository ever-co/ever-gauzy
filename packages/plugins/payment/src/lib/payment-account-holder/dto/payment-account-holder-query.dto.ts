import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { PaymentAccountHolderStatus, PaymentAccountHolderType } from '@gauzy/contracts';

/**
 * The narrowing members of the account list, as the endpoint catalogue states them.
 *
 * Every member narrows on a column the account table indexes for the read, so a filtered list is a
 * page of the same query rather than a scan filtered afterwards.
 */
export class PaymentAccountHolderFilterDTO {
	/**
	 * Restrict to the accounts of one party.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly contactId?: string;

	/**
	 * Restrict to the accounts of one provider registration.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentProviderId?: string;

	/**
	 * Restrict to the accounts of one provider key.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly providerKey?: string;

	/**
	 * Restrict to one kind of account.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentAccountHolderType })
	@IsOptional()
	@IsEnum(PaymentAccountHolderType)
	readonly type?: PaymentAccountHolderType;

	/**
	 * Restrict to one lifecycle status.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentAccountHolderStatus })
	@IsOptional()
	@IsEnum(PaymentAccountHolderStatus)
	readonly status?: PaymentAccountHolderStatus;

	/**
	 * Restrict to the accounts that settle in one currency.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly defaultCurrency?: string;
}

/**
 * The query of `GET /payment-account-holders`.
 *
 * Two spellings of the same filter are accepted, and both are the platform's own. The flat one
 * (`?contactId=…&status=ACTIVE`) is how this package's delivered list routes are called, and the
 * bracketed one (`?filter[contactId]=…`) is the query protocol the specification's endpoint table
 * names for this resource. Accepting only the first would leave the documented spelling silently
 * ignored — the request would answer a full page and the caller would believe it was filtered — which
 * is the failure mode the validation pipe is here to prevent.
 */
export class PaymentAccountHolderQueryDTO extends PaymentAccountHolderFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => PaymentAccountHolderFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => PaymentAccountHolderFilterDTO)
	readonly filter?: PaymentAccountHolderFilterDTO;

	/**
	 * How many accounts to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(100)
	readonly take?: number;

	/**
	 * How many accounts to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
