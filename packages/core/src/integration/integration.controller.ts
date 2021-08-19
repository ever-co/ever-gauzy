import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Param
} from '@nestjs/common';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { IntegrationType } from './integration-type.entity';
import { ApiResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IntegrationTypeGetCommand, IntegrationGetCommand } from './commands';
import { IntegrationEnum } from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Integrations')
@Controller()
export class IntegrationController {
	constructor(
		private readonly _integrationService: IntegrationService,
		private readonly _commandBus: CommandBus
	) {}

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
	 * GET Check integration remember state for tenant user 
	 * 
	 * @param integration 
	 * @param organizationId 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Check integration remember state for tenant user.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Checked state'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid request'
	})
	@Get('check/state/:integration/:organizationId')
	async checkRememberState(
		@Param('integration') integration: IntegrationEnum,
		@Param('organizationId', UUIDValidationPipe) organizationId: string
	): Promise<any> {
		return await this._integrationService.checkIntegrationRemeberState(
			integration,
			organizationId
		);
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
	@Get()
	async getIntegrations(
		@Query('filters', ParseJsonPipe) filters: any
	): Promise<Integration[]> {
		return await this._commandBus.execute(
			new IntegrationGetCommand(filters)
		);
	}
}
