import { ContextType, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
	constructor(private readonly _reflector: Reflector) {
		super();
	}

	/**
	 * Determines if the current request can be activated based on authorization and PUBLIC decorators.
	 *
	 * @param context - The execution context of the request.
	 * @returns `true` if access is allowed, otherwise `false`.
	 */
	canActivate(context: ExecutionContext) {
		console.log('AuthGuard canActivate called');

		// Retrieve the request object from the context
		const request = this.getRequest(context);

		// Allow CORS preflight (OPTIONS) requests to pass without authentication
		if (request.method === 'OPTIONS') {
			return true;
		}

		// Check if the route or controller has the PUBLIC decorator
		const isPublic =
			this._reflector.get<boolean>(PUBLIC_METHOD_METADATA, context.getHandler()) ||
			this._reflector.get<boolean>(PUBLIC_METHOD_METADATA, context.getClass());

		// Allow access if the method or class has the PUBLIC decorator
		if (isPublic) {
			return true;
		}

		// Delegate authorization to the parent guard (JWT or API Key authentication)
		return super.canActivate(context);
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
