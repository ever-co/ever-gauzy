import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { CrudController } from '../core';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { AuthGuard } from '@nestjs/passport';
import { IntegrationType } from './integration-type.entity';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IntegrationTypeGetCommand, IntegrationGetCommand } from './commands';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class IntegrationController extends CrudController<Integration> {
	constructor(
		private _integrationService: IntegrationService,
		private _commandBus: CommandBus
	) {
		super(_integrationService);
	}

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
	@Get()
	async getIntegrations(@Query('filters') filters): Promise<Integration[]> {
		const integrationFilter = JSON.parse(filters);
		return await this._commandBus.execute(
			new IntegrationGetCommand(integrationFilter)
		);
	}
}
