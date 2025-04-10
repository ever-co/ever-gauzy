import {
	Controller,
	Get,
	UseGuards,
	Query,
	NotFoundException,
	InternalServerErrorException,
	Logger,
	UnauthorizedException,
	BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {  PermissionsEnum, IZapierEndpoint } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { ZapierService } from './zapier.service';

@ApiTags('Zapier Integrations')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
@Controller('/integration/zapier')
export class ZapierController {
	private readonly logger = new Logger(ZapierController.name);

	constructor(private readonly zapierService: ZapierService) { }

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

	/**
	 * Helper method to validate Zapier token
	 */
	private validateToken(token: string, isThrowUnauthorizedOnMissingToken = false) {
		const exception = isThrowUnauthorizedOnMissingToken ? UnauthorizedException : BadRequestException;
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
}
