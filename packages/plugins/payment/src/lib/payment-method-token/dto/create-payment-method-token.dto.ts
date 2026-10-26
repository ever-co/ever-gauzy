import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsDateString,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	MinLength,
	ValidateNested
} from 'class-validator';
import { PaymentMethodTokenDTO } from './payment-method-token.dto';

/**
 * What the provider itself answered when the platform re-read the instrument at the provider.
 *
 * **This is the member that makes a token row a provider reference rather than a value a caller
 * composed.** The instrument is held in the provider's vault and the platform holds a reference that
 * is meaningless outside a call to that provider with the tenant's own credentials, so the creation
 * takes the provider's own answer as a required member and the service refuses a creation whose
 * reference and confirmation disagree. A reference no provider ever returned therefore cannot become
 * a stored instrument.
 */
export class PaymentMethodTokenConfirmationDTO {
	/**
	 * The reference the provider returned when the platform re-read the instrument at the provider.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly token: string;

	/**
	 * When the provider confirmed it. An ISO-8601 string, because a request body is JSON.
	 */
	@ApiProperty({ type: () => String })
	@IsDateString()
	readonly confirmedAt: string;
}

/**
 * Create PaymentMethodToken request.
 *
 * A saved instrument is written from a reference the **provider** issued and confirmed, and from
 * nothing else. The body therefore states the account the instrument belongs to, the provider's key,
 * the reference itself and the provider's confirmation of it, beside the display facts the provider
 * returned with it. It states no card member — see `PaymentMethodTokenDTO`.
 *
 * `providerKey` is required rather than derived from the account, and the service checks it against
 * the account's rather than trusting it: an instrument can never be moved to another provider than
 * its account's, so a body that names the wrong one is refused rather than silently corrected.
 */
export class CreatePaymentMethodTokenDTO extends PaymentMethodTokenDTO {
	/**
	 * The account at the provider this instrument belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly accountHolderId: string;

	/**
	 * The provider's stable key. Must equal the account's, and is checked rather than trusted.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	readonly providerKey: string;

	/**
	 * The reference the provider's own client-side flow issued to the buyer.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly token: string;

	/**
	 * The provider's own answer confirming that reference.
	 */
	@ApiProperty({ type: () => PaymentMethodTokenConfirmationDTO })
	@ValidateNested()
	@Type(() => PaymentMethodTokenConfirmationDTO)
	readonly providerConfirmation: PaymentMethodTokenConfirmationDTO;

	/**
	 * Whether this becomes the account's default for its kind. Only an `ACTIVE` instrument may hold the
	 * default, and the previous default of the same kind is cleared in the same transaction.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;
}
