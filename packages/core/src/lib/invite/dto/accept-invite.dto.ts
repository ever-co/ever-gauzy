import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsNotEmptyObject,
	IsOptional,
	IsString,
	MinLength,
	ValidateNested
} from 'class-validator';
import { IInviteAcceptInput, IUser, LanguagesEnum } from '@gauzy/contracts';
import { TermsAcceptanceClaimDTO } from './../../terms-acceptance/dto';

/**
 * Null-safe counterpart of the shared `@Trimmed()` decorator, for an UNAUTHENTICATED route.
 *
 * `@Trimmed()` calls `.trim()` on whatever it is handed, and a `@Transform` runs inside the pipe
 * BEFORE any validator does — so `{ "firstName": {} }` on this `@Public()` endpoint raised a raw
 * `TypeError` and came back as a 500 with a stack trace rather than a 400. Non-strings are passed
 * through untouched here so that `@IsString()` can reject them properly.
 */
export function trimOrNull({ value }: TransformFnParams): unknown {
	return typeof value === 'string' ? value.trim() || null : value;
}

/**
 * The profile fields an invitee may set on the account the invitation creates.
 *
 * Everything that DECIDES something is deliberately absent — `id`, `email`, `role`, `roleId`,
 * `tenant`, `tenantId`, `organizations`, `tags`, `thirdPartyId`, `imageId`, the `default*`/`last*`
 * pointers, `isActive`/`isArchived` and every credential column. `InviteAcceptHandler` pins the
 * identity fields from the invitation itself, and a field listed here would silently outrank that
 * pin: the `roleId` column beats the `role` relation on persist, and `user.organizations` is a
 * `cascade: true` relation whose rows would be inserted as real organization memberships.
 *
 * The in-repo accept form sends `firstName`, `lastName`, `email`, `role` and `tenant`; the last
 * three are dropped here and re-supplied server-side from the invitation, which is the same value
 * the form was displaying.
 */
export class AcceptInviteUserDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Transform(trimOrNull)
	readonly firstName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Transform(trimOrNull)
	readonly lastName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly imageUrl?: string;

	@ApiPropertyOptional({ type: () => String, enum: LanguagesEnum })
	@IsOptional()
	@IsEnum(LanguagesEnum)
	readonly preferredLanguage?: LanguagesEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly timeZone?: string;
}

/**
 * Accept invite request DTO validation.
 *
 * `POST /invite/accept` is `@Public()` and had no pipe at all, so the whole body flowed into
 * `AuthService.register()` — the shared user-creation sink — and into the raw employee repository
 * behind it. Whitelisting it here is what stops a field nobody declared from reaching a `create()`.
 *
 * Two client contracts this has to keep working, hence the shape:
 * - the Angular accept form posts `{ user, password, terms, token, email }`;
 * - Ever Teams posts the `{ code, email, user, password }` variant.
 *
 * So `token` and `code` are both optional and neither may be made mandatory; the handler picks the
 * branch from whichever one arrived.
 */
export class AcceptInviteDTO implements IInviteAcceptInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEmail()
	readonly email: string;

	/** Present on the emailed-link flow. Declared non-optional only to satisfy the contract type. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly token: string;

	/** Present on the code flow used by Ever Teams. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly code: string;

	/**
	 * Optional, and deliberately so: the endpoint has never required one, and an invitation
	 * accepted by somebody who already has an account in the tenant never reaches the password at
	 * all. Tightening that is a product decision, not part of closing this hole.
	 *
	 * The minimum matches the accept form's own validator so the server cannot reject a password
	 * the UI just told the invitee was acceptable.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(4, { message: 'Password should be at least 4 characters long.' })
	readonly password?: string;

	@ApiProperty({ type: () => AcceptInviteUserDTO })
	@IsNotEmptyObject()
	@ValidateNested()
	@Type(() => AcceptInviteUserDTO)
	// Declared as the contract type; @Type pins the class class-transformer actually builds, which
	// is what the whitelist is computed from.
	readonly user: IUser;

	/**
	 * The legal documents the acceptance form displayed, re-checked against the published corpus by
	 * `AuthService.register`.
	 */
	@ApiPropertyOptional({ type: () => [TermsAcceptanceClaimDTO] })
	@IsOptional()
	@IsArray()
	@ArrayNotEmpty({ message: 'Terms acceptance, when supplied, must list at least one document.' })
	@ValidateNested({ each: true })
	@Type(() => TermsAcceptanceClaimDTO)
	readonly terms?: TermsAcceptanceClaimDTO[];
}
