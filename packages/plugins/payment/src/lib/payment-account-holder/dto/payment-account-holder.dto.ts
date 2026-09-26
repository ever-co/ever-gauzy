import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { JsonData, PaymentAccountHolderType } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A party's account at one provider: the standing relationship a saved instrument, a mandate and an
 * off-session charge all hang off.
 *
 * The members are the descriptive facts of that relationship and nothing else. Neither the status nor
 * the provider's reference for the account is here, and that is the point rather than an omission: the
 * status starts at `PENDING` and moves only through the status machine, and the external account id is
 * written from the provider's own onboarding answer. A body that states either is refused by the
 * service with `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID` rather than accepted and ignored, and the
 * whitelisting pipe refuses it even earlier.
 *
 * `providerKey` is required and is deliberately *not* derived from `paymentProviderId`: it is the
 * column a row stays addressable by after a provider registration is removed, so the caller states it
 * and the service stores what it was given.
 */
export class PaymentAccountHolderDTO extends TenantOrganizationBaseDTO {
	/**
	 * The party the account belongs to. Absent for a tenant-level account owned by the organization.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly contactId?: string;

	/**
	 * The provider registration, when the caller knows which row the account belongs to.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentProviderId?: string;

	/**
	 * The provider's stable key, the same vocabulary the provider registry uses.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MaxLength(64)
	readonly providerKey: string;

	/**
	 * What kind of party the account belongs to. Defaults to `CUSTOMER` in the service.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentAccountHolderType })
	@IsOptional()
	@IsEnum(PaymentAccountHolderType)
	readonly type?: PaymentAccountHolderType;

	/**
	 * ISO 3166-1 alpha-2 country of establishment, which decides capabilities and mandate rules.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 2, maxLength: 2 })
	@IsOptional()
	@IsString()
	@Length(2, 2)
	readonly country?: string;

	/**
	 * The currency the account settles in. Absent means "resolve per charge from the collection".
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly defaultCurrency?: string;

	/**
	 * The provider's onboarding fragment plus tenant extras.
	 *
	 * `JsonData` rather than a narrow object type, because that is the column's own type: a request
	 * body is validated as an object here, and the row it is written to is the kernel's `JsonData`
	 * column the account entity declares.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}
