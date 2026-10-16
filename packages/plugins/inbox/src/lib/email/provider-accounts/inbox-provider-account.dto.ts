import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import {
	ID,
	IInboxProviderAccountCreateInput,
	IInboxProviderAccountUpdateInput,
	InboxProviderAccountScopeEnum,
	InboxProviderAccountStatusEnum
} from '@gauzy/contracts';

/** `?organizationId=` of the management routes (else the request's selected organization). */
export class InboxOrganizationQueryDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;
}

/** `POST /inbox/provider-accounts`. The configuration is checked against the provider's own form by the service. */
export class CreateInboxProviderAccountDTO implements IInboxProviderAccountCreateInput {
	@ApiProperty({ type: () => String, example: 'resend' })
	@IsString()
	@Matches(/^[a-z0-9][a-z0-9-]{0,31}$/)
	providerId!: string;

	@ApiProperty({ type: () => String, maxLength: 120 })
	@IsString()
	@MaxLength(120)
	name!: string;

	@ApiPropertyOptional({ enum: InboxProviderAccountScopeEnum })
	@IsOptional()
	@IsEnum(InboxProviderAccountScopeEnum)
	scope?: InboxProviderAccountScopeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	config?: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isDefaultOutbound?: boolean;
}

/** `PATCH /inbox/provider-accounts/:id`. */
export class UpdateInboxProviderAccountDTO implements IInboxProviderAccountUpdateInput {
	@ApiPropertyOptional({ type: () => String, maxLength: 120 })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	name?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	config?: Record<string, unknown>;

	@ApiPropertyOptional({ enum: [InboxProviderAccountStatusEnum.ACTIVE, InboxProviderAccountStatusEnum.DISABLED] })
	@IsOptional()
	@IsIn([InboxProviderAccountStatusEnum.ACTIVE, InboxProviderAccountStatusEnum.DISABLED])
	status?: InboxProviderAccountStatusEnum.ACTIVE | InboxProviderAccountStatusEnum.DISABLED;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isDefaultOutbound?: boolean;
}
