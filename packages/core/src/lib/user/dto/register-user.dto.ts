import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsNotEmpty,
	IsNotEmptyObject,
	IsOptional,
	IsUUID,
	MinLength,
	ValidateNested
} from 'class-validator';
import { IUserRegistrationInput } from '@gauzy/contracts';
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
}
