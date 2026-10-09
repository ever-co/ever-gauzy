import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNotEmptyObject,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MinLength,
	ValidateNested
} from 'class-validator';
import { IUserRegistrationInput } from '@gauzy/contracts';
import { CHECKOUT_SESSION_ID_PATTERN } from './../../shared/billing/billing-product';
import { Match } from './../../shared/validators';
import { TermsAcceptanceClaimDTO } from './../../terms-acceptance/dto';
import { CreateUserDTO } from './create-user.dto';

/**
 * Register User DTO validation
 */
export class RegisterUserDTO implements IUserRegistrationInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty({ message: 'Password should not be empty' })
	@MinLength(8, {
		message: 'Password should be at least 8 characters long.'
	})
	readonly password: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty({ message: 'Confirm password should not be empty' })
	@Match(RegisterUserDTO, (it) => it.password, {
		message: 'The password and confirmation password must match.'
	})
	readonly confirmPassword: string;

	@ApiProperty({ type: () => CreateUserDTO })
	@IsNotEmptyObject()
	@ValidateNested()
	@Type(() => CreateUserDTO)
	readonly user: CreateUserDTO;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly createdByUserId?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly featureAsEmployee?: boolean;

	/**
	 * The legal documents the user ticked the box for, exactly as the form
	 * displayed them.
	 *
	 * The register form has always rendered a hard-required terms checkbox — this
	 * is the field that field was missing. Without it the checkbox gated the
	 * submit button and the value went nowhere, which is the appearance of
	 * consent with none of the evidence.
	 *
	 * Optional at the DTO layer because registration is not only an interactive
	 * signup: imports, seeds and SUPER_ADMIN provisioning create users where no
	 * checkbox was ever shown, and fabricating an acceptance for them would be
	 * worse than recording none. `AuthService.register` decides what to do with
	 * an absent value; when present, every claim is verified against the
	 * published corpus before it is written.
	 */
	@ApiPropertyOptional({ type: () => [TermsAcceptanceClaimDTO] })
	@IsOptional()
	@IsArray()
	@ArrayNotEmpty({ message: 'Terms acceptance, when supplied, must list at least one document.' })
	@ValidateNested({ each: true })
	@Type(() => TermsAcceptanceClaimDTO)
	readonly terms?: TermsAcceptanceClaimDTO[];

	/**
	 * The Stripe Checkout Session the registrant just completed on the shared ever.co checkout, which
	 * forwards it to the register form as `checkout_session`.
	 *
	 * Optional, so every existing client keeps working unchanged (and an older API simply strips it,
	 * because this route whitelists). When present it is read by `SubscriptionRequiredGuard` as proof of
	 * purchase, and the web app carries the same id into tenant onboarding, where the new tenant is
	 * linked to the session's Stripe customer. Shape-checked here; everything that matters — that the
	 * session is complete, for this product, and was paid under this very address — is checked against
	 * Stripe server-side.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Stripe Checkout Session id (cs_live_... / cs_test_...)' })
	@IsOptional()
	@IsString()
	@Matches(CHECKOUT_SESSION_ID_PATTERN, { message: 'stripeCheckoutSessionId is not a Stripe Checkout Session id.' })
	readonly stripeCheckoutSessionId?: string;
}
