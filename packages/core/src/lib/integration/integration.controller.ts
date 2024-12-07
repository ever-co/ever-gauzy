import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { PermissionsEnum } from '@gauzy/contracts';
import { IntegrationTypeGetCommand, IntegrationGetCommand } from './commands';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';
import { Integration } from './integration.entity';
import { IntegrationType } from './integration-type.entity';

@ApiTags('Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
@Controller('/integration')
export class IntegrationController {
	constructor(private readonly _commandBus: CommandBus) {}

	/**
	 * GET all integration types
	 *
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all integration types.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found integration types',
		type: IntegrationType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/types')
	async getIntegrationTypes(): Promise<IntegrationType[]> {
		return await this._commandBus.execute(new IntegrationTypeGetCommand());
	}

	/**
	 * GET all system integrations
	 *
	 * @param filters
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all integrations.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found integrations',
		type: IntegrationType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/')
	async getIntegrations(@Query('filters', ParseJsonPipe) filters: any): Promise<Integration[]> {
		return await this._commandBus.execute(new IntegrationGetCommand(filters));
	}
}
