import { CanActivate, ContextType, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { TenantApiKeyService } from '../../tenant-api-key/tenant-api-key.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
	constructor(private readonly _tenantApiKeyService: TenantApiKeyService) {}

	/**
	 * Validates API Key and Secret from the request headers to determine if the request can proceed.
	 *
	 * @param context - The execution context of the request, which can be HTTP or GraphQL.
	 * @returns A promise resolving to `true` if authentication is successful, otherwise throws an `UnauthorizedException`.
	 * @throws `UnauthorizedException` if API Key or Secret is missing or invalid.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Retrieve the API Key and Secret from the request headers
		const request = this.getRequest(context);
		const apiKey = request.header('X-APP-ID');
		const apiSecret = request.header('X-API-KEY');

		if (!apiKey || !apiSecret) {
			throw new UnauthorizedException(
				'Missing API credentials. Please provide a valid X-APP-ID and X-API-KEY in the request headers to proceed.'
			);
		}

		// Proceed with API Key authentication if both are present
		const isValidKey = await this._tenantApiKeyService.validateApiKeyAndSecret(apiKey, apiSecret);

		if (!isValidKey) {
			throw new UnauthorizedException(
				'Access Denied: The provided X-APP-ID or X-API-KEY is invalid or does not have the required permissions.'
			);
		}

		return isValidKey;
	}

	/**
	 * Retrieves the request object from the execution context, supporting both HTTP and GraphQL requests.
	 *
	 * @param context - The execution context of the request.
	 * @returns The `Request` object extracted from the context.
	 */
	getRequest(context: ExecutionContext): Request {
		// Check if the execution context is of type 'graphql'
		if (context.getType<ContextType | 'graphql'>() === 'graphql') {
			// Extract the request object from the GraphQL context
			return GqlExecutionContext.create(context).getContext().req;
		}

		// If the context is HTTP-based, extract the request object from the HTTP context
		return context.switchToHttp().getRequest();
	}
}
