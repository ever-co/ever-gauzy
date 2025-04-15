import {
	Controller,
	Get,
	Res,
	UseGuards,
	Query,
	NotFoundException,
	InternalServerErrorException,
	Logger,
	UnauthorizedException,
	BadRequestException,
	HttpStatus
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@gauzy/common';
import { Response } from 'express';
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

	constructor(
		private readonly zapierService: ZapierService,
		private readonly _config: ConfigService
	) { }

		/**
		 * Handle successful login for Zapier OAuth flow
		 * This endpoint is called after successful authentication when the login was initiated by Zapier
		 */
		@ApiOperation({ summary: 'Handle successful login for Zapier OAuth' })
		@ApiResponse({
			status: HttpStatus.CREATED,
			description: 'Successful authentication and redirection to the callback URL'
		})
		@ApiResponse({
			status: HttpStatus.BAD_REQUEST,
			description: 'Invalid input, the response body may contain clues as to what went wrong'
		})
		@Public()
		@Get('login/success')
		async loginSuccess(@Query() query: { zapier_state?: string, zapier_redirect_uri?: string }, @Res() res: Response) {
			try {
				// Check if this is a Zapier auth flow
				const { zapier_state, zapier_redirect_uri } = query;
				const baseUrl = this._config.get<string>('baseUrl');
				if (zapier_state || zapier_redirect_uri) {
					const url = new URL(`${baseUrl ?? 'http://localhost:3000'}/api/integration/zapier/oauth/callback`);
					if (zapier_state) {
						url.searchParams.append('state', zapier_state);
					}
					if (zapier_redirect_uri) {
						url.searchParams.append('zapier_redirect_uri', zapier_redirect_uri);
					}
					return res.redirect(url.toString());
				} else {
					return res.redirect('/dashboard');
				}
			} catch (error) {
				console.error('Zapier OAuth login error:', error);
				return res.redirect('/auth/login?error=authentication_failed');
			}
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
