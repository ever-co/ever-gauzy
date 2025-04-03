import { Controller, Post, Body, Get, Param, UseGuards, Query, NotFoundException, InternalServerErrorException, Logger, UnauthorizedException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	IIntegrationTenant,
	IIntegrationSetting,
	PermissionsEnum,
	ID,
	ICreateZapierIntegrationInput,
	IZapierEndpoint
} from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { ZapierService } from './zapier.service';

@ApiTags('Zapier Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/zapier')
export class ZapierController {
	private readonly logger = new Logger(ZapierController.name);
	constructor(private readonly zapierService: ZapierService) {}

	@ApiOperation({ summary: 'Get Zapier integration token by integration ID' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier integration token'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/token/:integrationId')
	async getZapierTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<IIntegrationSetting> {
		try {
			const zapierSetting = await this.zapierService.getZapierToken(integrationId);
			if (!zapierSetting) {
				throw new NotFoundException(`No Zapier token found for integration ID ${integrationId}`);
			}
			return zapierSetting;
		} catch (error) {
			this.logger.error(`Failed to get Zapier token for integration ${integrationId}`, error);
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new InternalServerErrorException('Failed to retrieve Zapier integration token');
		}
	}

	@ApiOperation({ summary: 'Refresh Zapier integration token by integration ID' })
	@ApiResponse({
		status: 200,
		description: 'Successfully refreshed Zapier integration token'
	})
	@ApiResponse({
		status: 404,
		description: 'Integration not found'
	})
	@ApiResponse({
		status: 422,
		description: 'Token refresh failed due to invalid credentials or other validation errors'
	})
	@Get('/refresh-token/:integrationId')
	async refreshZapierTokenByIntegration(
		@Param('integrationId', UUIDValidationPipe) integrationId: ID
	): Promise<string> {
		try {
			const token = await this.zapierService.refreshToken(integrationId);
			if (!token) {
				// If service returns null/undefined, assume validation/credential error
				throw new UnprocessableEntityException(`Failed to refresh token - invalid credentials or validation error`);
			}
			return token;
		} catch (error) {
			this.logger.error(`Failed to refresh Zapier token for integration ${integrationId}`, error);

			// Re-throw specific errors
			if (error instanceof NotFoundException || error instanceof UnprocessableEntityException) {
				throw error;
			}

			// For unexpected errors, throw internal server error
			throw new InternalServerErrorException('Failed to refresh Zapier integration token');
		}
	}

	@ApiOperation({ summary: 'Create new Zapier integration' })
	@ApiResponse({
		status: 200,
		description: 'Successfully created Zapier integration'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Post('/integration')
	async create(@Body() body: ICreateZapierIntegrationInput): Promise<IIntegrationTenant> {
		try {
			return await this.zapierService.addIntegration(body);
		} catch (error) {
			this.logger.error('Failed to create Zapier integration', error);
			throw new InternalServerErrorException('Failed to create Zapier integration');
		}
	}

	/**
	 * Helper method to validate Zapier token
	 */
	private validateToken(token: string, isAction: boolean = false) {
		const exception = isAction ? UnauthorizedException : BadRequestException;
		if (!token) {
			throw new exception('Token parameter is required');
		}
		if (!token.trim()) {
			throw new exception('Token parameter cannot be empty');
		}
	}

	/**
	 * Helper method to handle Zapier endpoint errors
	 */
	private handleZapierError(error: any, endpointType: string): never {
		this.logger.error(`Failed to fetch Zapier ${endpointType}`, error);

		// Re-throw specific known errors
		if (error instanceof UnauthorizedException) {
			throw error;
		}
		if (error instanceof BadRequestException) {
			throw error;
		}
		if (error instanceof NotFoundException) {
			throw error;
		}

		// For unexpected errors, include original error message
		throw new InternalServerErrorException(
			`Failed to fetch Zapier ${endpointType}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}

	@ApiOperation({ summary: 'Get available Zapier triggers' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier triggers'
	})
	@ApiResponse({
		status: 400,
		description: 'Bad Request - Missing or empty token parameter'
	})
	@Get('/triggers')
	async getTriggers(@Query('token') token: string): Promise<IZapierEndpoint[]> {
		this.validateToken(token);
		try {
			return await this.zapierService.fetchTriggers(token);
		} catch (error) {
			this.handleZapierError(error, 'triggers');
		}
	}

	@ApiOperation({ summary: 'Get available Zapier actions' })
	@ApiResponse({
		status: 200,
		description: 'Successfully retrieved Zapier actions'
	})
	@ApiResponse({
		status: 401,
		description: 'Unauthorized - Invalid or missing authorization token'
	})
	@Get('/actions')
	async getActions(@Query('token') token: string): Promise<IZapierEndpoint[]> {
		this.validateToken(token, true);
		try {
			return await this.zapierService.fetchActions(token);
		} catch (error) {
			this.handleZapierError(error, 'actions');
		}
	}
}
