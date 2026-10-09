import {
	Controller,
	Post,
	Get,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpCode,
	HttpStatus,
	UseGuards,
	Header
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	Permissions,
	UUIDValidationPipe,
	UseValidationPipe,
	PermissionGuard,
	TenantPermissionGuard
} from '@gauzy/core';
import { EverAsyncIntegrationService } from './ever-async-integration.service';
import { ConfigureEverAsyncIntegrationDto, UpdateEverAsyncSettingsDto, VerifyEverAsyncConnectionDto } from './dto';

@ApiTags('Ever Async Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/integration/ever-async')
export class EverAsyncController {
	constructor(private readonly service: EverAsyncIntegrationService) {}

	@Post('/setup')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UseValidationPipe()
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Connect Ever Async and return its read-only credential once.' })
	setupIntegration(@Body() dto: ConfigureEverAsyncIntegrationDto, @Query('organizationId') organizationId?: ID) {
		return this.service.setupIntegration(dto, organizationId);
	}

	@Get('/settings')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	getSettings(@Query('organizationId') organizationId?: ID) {
		return this.service.getSettings(organizationId);
	}

	@Get('/options')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	getOptions(@Query('organizationId') organizationId?: ID) {
		return this.service.getOptions(organizationId);
	}

	@Put('/settings')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe()
	updateSettings(@Body() dto: UpdateEverAsyncSettingsDto, @Query('organizationId') organizationId?: ID) {
		return this.service.updateSettings(dto, organizationId);
	}

	@Post('/credentials/rotate')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	rotateCredentials(@Query('organizationId') organizationId?: ID) {
		return this.service.rotateCredentials(organizationId);
	}

	@Post('/verify')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe()
	@ApiOperation({ summary: 'Check server reachability. This does not install or authenticate a chat integration.' })
	verifyConnection(@Body() dto: VerifyEverAsyncConnectionDto) {
		return this.service.verifyConnection(dto.serverUrl);
	}

	@Get('/status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	getStatus(@Query('organizationId') organizationId?: ID) {
		return this.service.getStatus(organizationId);
	}

	@Delete('/:integrationTenantId')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@HttpCode(HttpStatus.OK)
	removeIntegration(
		@Param('integrationTenantId', UUIDValidationPipe) integrationTenantId: ID,
		@Query('organizationId') organizationId?: ID
	) {
		return this.service.removeIntegration(integrationTenantId, organizationId);
	}
}
