import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { JsonData, PaymentMethodTokenType } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The descriptive facts of one saved instrument.
 *
 * These are exactly the facts a caller may state about an instrument and, apart from the kind, exactly
 * the facts a later write may change. The provider's reference is deliberately **not** here: it is
 * stated once, on the creation, because it is what the provider issued rather than a property of the
 * row, and `token` — the member that carries it — never appears in a request that is not a creation.
 *
 * **No member of this DTO, and no member of any DTO in this package, carries card data.** There is no
 * `number`, `pan`, `cvc`, `cvv`, `iban`, `accountNumber` or free-text `expiry` anywhere, and none may
 * be added: the platform stores a provider-issued token and holds no primary account number, no
 * verification value and no full bank account number. A body that carries one is refused by
 * `RejectCardDataPipe` with `PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED` before this contract is applied.
 */
export class PaymentMethodTokenDTO extends TenantOrganizationBaseDTO {
	/**
	 * What kind of instrument this is. Defaults to `CARD` in the service.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentMethodTokenType })
	@IsOptional()
	@IsEnum(PaymentMethodTokenType)
	readonly type?: PaymentMethodTokenType;

	/**
	 * The provider's brand label, exactly as the provider reports it. Display only.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly brand?: string;

	/**
	 * The last four digits the provider returns. Display only, and never a primary account number.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 4 })
	@IsOptional()
	@IsString()
	@MaxLength(4)
	readonly last4?: string;

	/**
	 * 1–12, and only for a kind of instrument that expires.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 12 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(12)
	readonly expiryMonth?: number;

	/**
	 * Four digits. Together with `expiryMonth` it feeds the expiry sweep and the expiry refusal.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 2000, maximum: 2199 })
	@IsOptional()
	@IsInt()
	@Min(2000)
	@Max(2199)
	readonly expiryYear?: number;

	/**
	 * The name on the instrument, as the provider reports it.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly holderName?: string;

	/**
	 * The address the instrument bills to, from the address book.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly billingAddressId?: string;

	/**
	 * The provider fragment plus tenant extras.
	 *
	 * `JsonData` rather than a narrow object type, because that is the column's own type: a request
	 * body is validated as an object here, and the row it is written to is the kernel's `JsonData`
	 * column the instrument entity declares.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}
