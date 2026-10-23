import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../ever-works.constants';
import { EverWorksConnectDto, EverWorksKeyDto } from './dto/ever-works-connection.dto';
import { EverWorksConnectionService } from './ever-works-connection.service';

/**
 * `/api/integration/ever-works/connections*` (plan 06 G-P1-3). Every route needs a signed-in user of the
 * tenant with the integration permission named, plus an active membership of the organization
 * (`organizationId` query parameter, else the selected one). Keys are write-only; no response carries
 * the key or the webhook secret, and every response is `Cache-Control: no-store`.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/connections`)
export class EverWorksConnectionController {
	constructor(private readonly connections: EverWorksConnectionService) {}

	@Get()
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "This tenant's active Ever Works connection, or null." })
	current(@Query('organizationId') organizationId?: ID) {
		return this.connections.current(organizationId);
	}

	@Post('/validate')
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Describe an Ever Works integration key (whoami) without storing anything.' })
	validate(@Body() dto: EverWorksConnectDto, @Query('organizationId') organizationId?: ID) {
		return this.connections.validate(dto, organizationId);
	}

	@Post()
	@Permissions(PermissionsEnum.INTEGRATION_ADD)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Connect this tenant to Ever Works with an integration key (validated, stored encrypted).' })
	connect(@Body() dto: EverWorksConnectDto, @Query('organizationId') organizationId?: ID) {
		return this.connections.connect(dto, organizationId);
	}

	@Get('/:id')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	get(@Param('id', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.connections.get(id, organizationId);
	}

	@Put('/:id/key')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Swap in a new integration key of the same Ever Works tenant (rotation or re-authentication).' })
	rotateKey(@Param('id', UUIDValidationPipe) id: ID, @Body() dto: EverWorksKeyDto, @Query('organizationId') organizationId?: ID) {
		return this.connections.rotateKey(id, dto, organizationId);
	}

	@Post('/:id/pause')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	pause(@Param('id', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.connections.pause(id, organizationId);
	}

	@Post('/:id/resume')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	resume(@Param('id', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.connections.resume(id, organizationId);
	}

	@Post('/:id/health')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Run the health check (whoami) now.' })
	health(@Param('id', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.connections.health(id, organizationId);
	}

	@Post('/:id/webhook')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Register (or replace) the Ever Works webhook subscription of this connection.' })
	registerWebhook(@Param('id', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.connections.registerWebhook(id, organizationId);
	}

	@Delete('/:id')
	@Permissions(PermissionsEnum.INTEGRATION_DELETE)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Disconnect: archive the connection and its organization mappings; synced data is kept.' })
	disconnect(@Param('id', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.connections.disconnect(id, organizationId);
	}
}
