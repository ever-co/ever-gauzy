import { CanActivate, ContextType, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

@Injectable()
export abstract class BaseGuard implements CanActivate {
	/**
	 * Determines whether the current request is authorized to proceed.
	 * @param context - The execution context of the request.
	 * @returns A boolean or a Promise resolving to a boolean indicating whether the request is allowed.
	 */
	canActivate(context: ExecutionContext): boolean | Promise<boolean> {
		// Implement your authorization logic here
		return true; // Allow all requests; replace with actual logic
	}

	/**
	 * Retrieves the request object from the execution context, supporting both HTTP and GraphQL requests.
	 *
	 * @param context - The execution context of the request.
	 * @returns The `Request` object extracted from the context.
	 */
	protected getRequest(context: ExecutionContext): Request {
		// Check if the execution context is of type 'graphql'
		if (context.getType<ContextType | 'graphql'>() === 'graphql') {
			// Extract the request object from the GraphQL context
			return GqlExecutionContext.create(context).getContext().req;
		}

		// If the context is HTTP-based, extract the request object from the HTTP context
		return context.switchToHttp().getRequest();
	}
}
