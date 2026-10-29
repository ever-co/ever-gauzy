import { Body, Controller, Get, Header, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import {
	EverWorksInboxPreferencesService,
	EverWorksInboxPreferencesView
} from './ever-works-inbox-preferences.service';

/** One flag per Ever Works inbox kind (`true`: sent to Ever Works); a kind left out keeps its value. */
export class EverWorksInboxKindsDto {
	@ApiPropertyOptional({ description: 'Notices (read-only information).' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly notice?: boolean;

	@ApiPropertyOptional({ description: 'Questions (and escalations).' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly question?: boolean;

	@ApiPropertyOptional({ description: 'Approvals.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly approval?: boolean;

	@ApiPropertyOptional({ description: 'Mentions.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly mention?: boolean;

	@ApiPropertyOptional({ description: 'Assignments.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly assignment?: boolean;

	@ApiPropertyOptional({ description: 'Emails of my mailboxes.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly email?: boolean;

	@ApiPropertyOptional({ description: 'Anything else.' })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	readonly other?: boolean;
}

export class EverWorksInboxPreferencesDto {
	@ApiProperty({ type: EverWorksInboxKindsDto })
	@IsObject()
	@ValidateNested()
	@Type(() => EverWorksInboxKindsDto)
	readonly kinds!: EverWorksInboxKindsDto;
}

/**
 * `/api/integration/ever-works/me/inbox-preferences`: the signed-in person's own choice of what of their Gauzy Inbox
 * goes to Ever Works. The person is always the caller (from the credential, never a parameter); `INBOX_VIEW`, as the
 * Inbox itself.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/me/inbox-preferences`)
export class EverWorksInboxPreferencesController {
	constructor(private readonly preferences: EverWorksInboxPreferencesService) {}

	@Get()
	@Permissions(PermissionsEnum.INBOX_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Which kinds of my Gauzy Inbox items go to Ever Works, and where they go.' })
	mine(): Promise<EverWorksInboxPreferencesView> {
		return this.preferences.mine();
	}

	@Put()
	@Permissions(PermissionsEnum.INBOX_VIEW)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
	@ApiOperation({
		summary: 'Choose which kinds of my Gauzy Inbox items go to Ever Works (every kind is on by default).'
	})
	update(@Body() dto: EverWorksInboxPreferencesDto): Promise<EverWorksInboxPreferencesView> {
		return this.preferences.updateMine({ ...dto.kinds });
	}
}
