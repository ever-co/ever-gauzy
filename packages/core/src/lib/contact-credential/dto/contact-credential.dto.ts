import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEmail,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { parseToBoolean } from '@gauzy/utils';

/**
 * What a caller states when it records a party's login.
 *
 * **`password` is the only secret-shaped member this contract has, and it is not a secret.** It is the
 * password the party chose, hashed by the platform's own password hasher at this boundary before the
 * service is reached — which is the contract `ContactCredentialService.createCredential` states when it
 * demands a hash and refuses a plaintext. The four secrets the row *stores* — the hash, the
 * authenticator secret and the two single-use tokens — are absent from this class by construction, and
 * a body that carries one is refused before validation by `RejectCredentialSecretPipe`, in the code the
 * catalogue publishes for exactly that member.
 *
 * `isVerified` is absent too: a credential is created unconfirmed, and confirmation is what redeeming
 * the verification token observes. A caller that could state it would be asserting a fact about an
 * address it has not proved it controls.
 */
export class CreateContactCredentialDTO extends TenantOrganizationBaseDTO {
	/**
	 * The contact this credential authenticates. One contact is one login.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly customerId: ID;

	/**
	 * The login identifier. Stored trimmed and lower-cased, and it resolves one credential per tenant.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@IsEmail()
	@MaxLength(255)
	readonly email: string;

	/**
	 * The password the party chose, hashed at this boundary by the platform's password hasher.
	 */
	@ApiProperty({ type: () => String, minLength: 8, maxLength: 128 })
	@IsString()
	@MinLength(8)
	@MaxLength(128)
	readonly password: string;

	/**
	 * Tenant-defined extras. Never a place for a secret, and never a place for a recovery code.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The narrowing members of the credential list, in the flat spelling.
 *
 * The three members are the ones the delivered list method narrows on, so a caller can ask the question
 * the management surface asks — which credentials exist for this contact, whether one is confirmed, and
 * whether an address is already a login of this tenant — without reading a page and filtering it.
 */
export class ContactCredentialFilterDTO {
	/**
	 * Restrict to the credential of one contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	/**
	 * Restrict to one login identifier, matched on the stored normalised form.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly email?: string;

	/**
	 * Restrict to confirmed or to unconfirmed credentials. Read with the platform's own boolean reader.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isVerified?: boolean;
}

/**
 * The query of `GET /contact-credentials`.
 *
 * Both spellings of the same filter are accepted, as on every list route of this platform: the flat
 * one, and the bracketed one (`?filter[customerId]=…`) the endpoint table's rows use. Asking for one
 * contact's credentials is this route with `filter[customerId]` stated — the table hangs that read off
 * `/organization-contacts/:id/credentials`, which is the contact resource's path and therefore the
 * contact domain's route to add, not this one's.
 */
export class ContactCredentialQueryDTO extends ContactCredentialFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => ContactCredentialFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ContactCredentialFilterDTO)
	readonly filter?: ContactCredentialFilterDTO;

	/**
	 * How many credentials to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many credentials to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
