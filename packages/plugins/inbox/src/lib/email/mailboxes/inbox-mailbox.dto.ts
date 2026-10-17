import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsIn,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	ValidateNested
} from 'class-validator';
import {
	ID,
	IInboxMailboxCreateInput,
	IInboxMailboxMemberInput,
	IInboxMailboxProvisionInput,
	IInboxMailboxUpdateInput,
	InboxMailboxKindEnum,
	InboxMailboxMemberRoleEnum,
	InboxMailboxOwnerTypeEnum
} from '@gauzy/contracts';

const KINDS = [
	InboxMailboxKindEnum.PLATFORM,
	InboxMailboxKindEnum.CUSTOM_DOMAIN,
	InboxMailboxKindEnum.FORWARDING
] as const;

/** `POST /inbox/mailboxes`. The service checks the owner, the address and the account. */
export class CreateInboxMailboxDTO implements IInboxMailboxCreateInput {
	@ApiProperty({ enum: InboxMailboxOwnerTypeEnum })
	@IsEnum(InboxMailboxOwnerTypeEnum)
	ownerType!: InboxMailboxOwnerTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	ownerEmployeeId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	ownerTeamId?: ID;

	@ApiPropertyOptional({ enum: KINDS })
	@IsOptional()
	@IsIn([...KINDS])
	kind?: (typeof KINDS)[number];

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	localPart?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 253 })
	@IsOptional()
	@IsString()
	@MaxLength(253)
	domain?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	displayName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	providerAccountId?: ID | null;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(200)
	@IsString({ each: true })
	senderAllowlist?: string[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 320 })
	@IsOptional()
	@IsString()
	@MaxLength(320)
	forwardFrom?: string;
}

/** `PATCH /inbox/mailboxes/:id`. */
export class UpdateInboxMailboxDTO implements IInboxMailboxUpdateInput {
	@ApiPropertyOptional({ type: () => String, maxLength: 200 })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	displayName?: string | null;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(200)
	@IsString({ each: true })
	senderAllowlist?: string[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	providerAccountId?: ID | null;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	settings?: Record<string, unknown> | null;
}

export class InboxMailboxMemberDTO implements IInboxMailboxMemberInput {
	@ApiProperty({ type: () => String })
	@IsUUID()
	userId!: ID;

	@ApiPropertyOptional({ enum: InboxMailboxMemberRoleEnum })
	@IsOptional()
	@IsEnum(InboxMailboxMemberRoleEnum)
	role?: InboxMailboxMemberRoleEnum;
}

/** `PUT /inbox/mailboxes/:id/members`. */
export class SetInboxMailboxMembersDTO {
	@ApiProperty({ type: () => [InboxMailboxMemberDTO] })
	@IsArray()
	@ArrayMaxSize(500)
	@ValidateNested({ each: true })
	@Type(() => InboxMailboxMemberDTO)
	members!: InboxMailboxMemberDTO[];
}

/** `POST /inbox/mailboxes/provision`. */
export class ProvisionInboxMailboxesDTO implements IInboxMailboxProvisionInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	employees?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	defaultOrganizationMailbox?: boolean;
}

/** `PUT /inbox/mailboxes/settings`. */
export class InboxEmailSettingsDTO {
	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	autoProvisionEmployees!: boolean;
}
