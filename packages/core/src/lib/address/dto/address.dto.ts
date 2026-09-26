import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
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
import { AddressOwnerType, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { AddressRoleEnum } from '../../address-role/address-role.enums';
import { parseToBoolean } from '@gauzy/utils';

/**
 * What a caller states when it records an address in the book.
 *
 * **The validation verdict is absent, and its absence is the contract.** `isValidated` and
 * `validationProviderKey` are the address-validation strategy's own statement, written by the
 * operation that actually asked a validator; the service refuses a body that carries one rather than
 * ignoring it, because a caller that believes it validated an address would otherwise never learn
 * that it did not.
 *
 * **The two default flags are accepted and are not written as booleans.** A body that states one is
 * routed by the service to `setDefaultAddress`, which moves the party's authoritative column, the
 * address's own mirror and the role row together — the route never writes the flag itself, because
 * two locations answering one question is the defect the authority rule exists for.
 *
 * `countryCode` is what a tax rate, a shipping option and a carrier label match on, so it is required
 * here and normalised by the service; `countryId` is resolved from it and a stated row that
 * contradicts the code is refused.
 */
export class CreateAddressDTO extends TenantOrganizationBaseDTO {
	/**
	 * Customer-facing nickname.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly label?: string;

	/**
	 * The person to address at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly contactName?: string;

	/**
	 * Company name as it should appear on a label or an invoice.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly company?: string;

	/**
	 * First name of the person at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly firstName?: string;

	/**
	 * Last name of the person at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly lastName?: string;

	/**
	 * Telephone number, as entered.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly phone?: string;

	/**
	 * E-mail address, as entered.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly email?: string;

	/**
	 * Street address. Required: an address that names no street names nothing.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly line1: string;

	/**
	 * Second line of the street address — a unit, a floor, a building.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly line2?: string;

	/**
	 * City or locality. Required.
	 */
	@ApiProperty({ type: () => String, maxLength: 128 })
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	readonly city: string;

	/**
	 * Free-text province name as entered.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly province?: string;

	/**
	 * Normalised province or state code — the form a rate table is keyed by.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly provinceCode?: string;

	/**
	 * Postal or ZIP code, as entered.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly postalCode?: string;

	/**
	 * ISO 3166-1 alpha-2 country code. Required; the service normalises it to upper case.
	 */
	@ApiProperty({ type: () => String, maxLength: 2, minLength: 2 })
	@IsString()
	@MinLength(2)
	@MaxLength(2)
	readonly countryCode: string;

	/**
	 * The country lookup row, when the caller already resolved one. Refused when it contradicts the code.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly countryId?: ID;

	/**
	 * Latitude, when the caller geocoded the address.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	readonly latitude?: number;

	/**
	 * Longitude, when the caller geocoded the address.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	readonly longitude?: number;

	/**
	 * Whether this address becomes the party's default shipping address. Routed to `setDefaultAddress`.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefaultShipping?: boolean;

	/**
	 * Whether this address becomes the party's default billing address. Routed to `setDefaultAddress`.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefaultBilling?: boolean;

	/**
	 * What kind of thing the address belongs to. Defaults to `CONTACT`.
	 */
	@ApiPropertyOptional({ type: () => String, enum: AddressOwnerType })
	@IsOptional()
	@IsEnum(AddressOwnerType)
	readonly ownerType?: AddressOwnerType;

	/**
	 * The id of the row `ownerType` names. Required: an address belongs to something.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly ownerId: ID;

	/**
	 * The buyer this address is scoped to, when its owner is a party. Must equal `ownerId` then.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	/**
	 * Tenant extras, including the raw provider response once a validator has answered.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * What a caller may change on an address that exists.
 *
 * Every member is optional, and the owner pair is among them deliberately: an address legitimately
 * moves from one warehouse to another, or from a warehouse to the organization itself, and the
 * service re-runs the owner-consistency check and the default rule on the new owner's book when it
 * does. A stated default flag is not written here either — it is routed to the operation that moves
 * a default, or refused where clearing it would contradict the party's own column.
 */
export class UpdateAddressDTO extends TenantOrganizationBaseDTO {
	/**
	 * Customer-facing nickname.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly label?: string;

	/**
	 * The person to address at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly contactName?: string;

	/**
	 * Company name as it should appear on a label or an invoice.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly company?: string;

	/**
	 * First name of the person at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly firstName?: string;

	/**
	 * Last name of the person at this location.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly lastName?: string;

	/**
	 * Telephone number.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly phone?: string;

	/**
	 * E-mail address.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly email?: string;

	/**
	 * Street address. Never cleared to empty.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly line1?: string;

	/**
	 * Second line of the street address.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly line2?: string;

	/**
	 * City or locality. Never cleared to empty.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	readonly city?: string;

	/**
	 * Free-text province name.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 128 })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly province?: string;

	/**
	 * Normalised province or state code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly provinceCode?: string;

	/**
	 * Postal or ZIP code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly postalCode?: string;

	/**
	 * ISO 3166-1 alpha-2 country code; normalised to upper case by the service.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 2, minLength: 2 })
	@IsOptional()
	@IsString()
	@MinLength(2)
	@MaxLength(2)
	readonly countryCode?: string;

	/**
	 * The country lookup row, when the caller resolved one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly countryId?: ID;

	/**
	 * Latitude.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	readonly latitude?: number;

	/**
	 * Longitude.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	readonly longitude?: number;

	/**
	 * Whether this address becomes the party's default shipping address.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefaultShipping?: boolean;

	/**
	 * Whether this address becomes the party's default billing address.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefaultBilling?: boolean;

	/**
	 * What kind of thing the address belongs to.
	 */
	@ApiPropertyOptional({ type: () => String, enum: AddressOwnerType })
	@IsOptional()
	@IsEnum(AddressOwnerType)
	readonly ownerType?: AddressOwnerType;

	/**
	 * The id of the row `ownerType` names.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly ownerId?: ID;

	/**
	 * The buyer this address is scoped to, when its owner is a party.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	/**
	 * Tenant extras, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The narrowing members of the address list, in the flat spelling.
 *
 * The members are exactly the ones the delivered list method narrows on, so the route and the
 * GraphQL connection select the same rows. `isDefaultShipping` and `isDefaultBilling` are read with
 * the platform's own boolean reader: a query string carries text, and a plain cast would read the
 * word `false` as true and answer the opposite question.
 */
export class AddressFilterDTO {
	/**
	 * Restrict to one party's book.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: ID;

	/**
	 * Restrict to one country code.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 2, minLength: 2 })
	@IsOptional()
	@IsString()
	@MaxLength(2)
	readonly countryCode?: string;

	/**
	 * Restrict to the addresses of one kind of owner.
	 */
	@ApiPropertyOptional({ type: () => String, enum: AddressOwnerType })
	@IsOptional()
	@IsEnum(AddressOwnerType)
	readonly ownerType?: AddressOwnerType;

	/**
	 * Restrict to one owner row.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly ownerId?: ID;

	/**
	 * Restrict to the default shipping address, or to the ones that are not.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isDefaultShipping?: boolean;

	/**
	 * Restrict to the default billing address, or to the ones that are not.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isDefaultBilling?: boolean;

	/**
	 * Restrict to addresses a validation strategy has confirmed.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isValidated?: boolean;
}

/**
 * The query of `GET /addresses`.
 *
 * Both spellings of the same filter are accepted: the flat one this platform's delivered list routes
 * are called with, and the bracketed one (`?filter[countryCode]=DE`) the endpoint table names for the
 * resource. The bracketed members win when both are stated, because that is the spelling the
 * specification fixes.
 */
export class AddressQueryDTO extends AddressFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => AddressFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => AddressFilterDTO)
	readonly filter?: AddressFilterDTO;

	/**
	 * How many addresses to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many addresses to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}

/**
 * One role an address plays, as the whole-set replacement states it.
 */
export class AddressRoleMemberDTO {
	/**
	 * The role the address plays.
	 */
	@ApiProperty({ type: () => String, enum: AddressRoleEnum })
	@IsEnum(AddressRoleEnum)
	readonly role: AddressRoleEnum;

	/**
	 * Whether it is the default for that role. Only `SHIPPING` and `BILLING` have a default, and a
	 * stated value that contradicts the address's own flag is refused rather than written.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly isDefault?: boolean;

	/**
	 * Tenant extras kept on the role row.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The roles an address plays afterwards.
 *
 * The replacement is a **set** rather than a member-per-call pair, for the reason the channel's
 * region set is one: "revoke this role" and "assign that one" as two calls can each fail on their own
 * and leave a set nobody asked for. A role the body leaves out is revoked and a newly stated one is
 * assigned, so the call means "these are the roles now".
 */
export class ReplaceAddressRolesDTO {
	/**
	 * The complete set of roles the address plays afterwards.
	 */
	@ApiProperty({ type: () => [AddressRoleMemberDTO] })
	@IsArray()
	@ArrayMinSize(0)
	@ValidateNested({ each: true })
	@Type(() => AddressRoleMemberDTO)
	readonly roles: AddressRoleMemberDTO[];
}

/**
 * The role a default operation names.
 *
 * The role is required and validated as the platform's own enumeration, so an unknown role is a
 * validation failure rather than a write the service has to refuse a second time. A role that has no
 * default — `RETURN`, `PAYOUT`, `REMIT_TO`, `REGISTERED` — is refused by the service, which is where
 * the fact that only two roles have one is stated.
 */
export class SetAddressDefaultDTO {
	/**
	 * The role whose default the operation moves.
	 */
	@ApiProperty({ type: () => String, enum: AddressRoleEnum })
	@IsEnum(AddressRoleEnum)
	readonly role: AddressRoleEnum;
}
