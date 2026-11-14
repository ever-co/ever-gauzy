import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import {
	ID,
	IEmployeePlaceholderBulkCreateInput,
	IEmployeePlaceholderClaimInput,
	IEmployeePlaceholderCreateInput,
	IEmployeePlaceholderMemberInput,
	IEmployeePlaceholderMergeInput,
	InvitationExpirationEnum
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/** The most members one bulk creation takes. */
export const PLACEHOLDER_BULK_LIMIT = 500;

/** The most teams one creation adds a member to. */
const PLACEHOLDER_TEAMS_LIMIT = 50;

/** A member without an account, as a creation names it. */
export class EmployeePlaceholderMemberDTO implements IEmployeePlaceholderMemberInput {
	@ApiProperty({ type: () => String, maxLength: 100 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	readonly firstName: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 100 })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	readonly lastName?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Never a login: kept to show it and to send a claim.' })
	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	readonly email?: string;
}

/** The teams of the organization a creation adds its members to. */
export class EmployeePlaceholderTeamsDTO {
	@ApiPropertyOptional({ type: () => [String], description: 'Teams of the organization the members join.' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(PLACEHOLDER_TEAMS_LIMIT)
	@IsUUID('all', { each: true })
	readonly teamIds?: ID[];
}

/** `POST /employee-placeholder`: one member without an account. */
export class CreateEmployeePlaceholderDTO
	extends IntersectionType(TenantOrganizationBaseDTO, EmployeePlaceholderMemberDTO, EmployeePlaceholderTeamsDTO)
	implements IEmployeePlaceholderCreateInput {}

/** `POST /employee-placeholder/bulk`: many members without an account, for an import. */
export class BulkCreateEmployeePlaceholderDTO
	extends IntersectionType(TenantOrganizationBaseDTO, EmployeePlaceholderTeamsDTO)
	implements IEmployeePlaceholderBulkCreateInput
{
	@ApiProperty({ type: () => [EmployeePlaceholderMemberDTO] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(PLACEHOLDER_BULK_LIMIT)
	@ValidateNested({ each: true })
	@Type(() => EmployeePlaceholderMemberDTO)
	readonly members: EmployeePlaceholderMemberDTO[];
}

/** `POST /employee-placeholder/:id/claim`: the claim invitation of a member without an account. */
export class ClaimEmployeePlaceholderDTO extends TenantOrganizationBaseDTO implements IEmployeePlaceholderClaimInput {
	@ApiProperty({ type: () => String })
	@IsEmail()
	@MaxLength(254)
	readonly email: string;

	@ApiPropertyOptional({
		type: () => String,
		description: 'The page that accepts the invitation; it receives the email and the invitation code.'
	})
	@IsOptional()
	@IsString()
	readonly callbackUrl?: string;

	@ApiPropertyOptional({ type: () => String, enum: InvitationExpirationEnum })
	@IsOptional()
	@IsEnum(InvitationExpirationEnum)
	readonly invitationExpirationPeriod?: InvitationExpirationEnum;
}

/** `GET /employee-placeholder/:id/merge-preview` and `POST /employee-placeholder/:id/merge`. */
export class MergeEmployeePlaceholderDTO extends TenantOrganizationBaseDTO implements IEmployeePlaceholderMergeInput {
	@ApiProperty({ type: () => String, description: 'The member with an account who takes it all.' })
	@IsUUID()
	readonly targetEmployeeId: ID;
}
