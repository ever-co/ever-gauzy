import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard to restrict access to a route based on the request's origin header.
 *
 * This guard checks if the request's `Origin` header matches the allowed origin.
 * If the origin does not match, access to the route is denied.
 */
@Injectable()
export class ProxyPluginOriginGuard implements CanActivate {
	// The allowed origin for this route
	private readonly allowedOrigin = process.env.PROXY_PLUGIN;

	/**
	 * Determines whether the current request is allowed based on its origin.
	 *
	 * @param context - The execution context, which provides details about the current request.
	 * @returns {boolean} - Returns `true` if the origin is allowed, otherwise throws an exception.
	 * @throws {ForbiddenException} - If the origin is not allowed.
	 */
	canActivate(context: ExecutionContext): boolean {
		// Extract the HTTP request object from the execution context
		const request = context.switchToHttp().getRequest();

		// Retrieve the `Origin` header from the request
		const origin = request.headers.origin;

		// Check if the origin matches the allowed origin
		if (origin !== this.allowedOrigin) {
			// If not, deny access by throwing a ForbiddenException
			throw new ForbiddenException('Access denied from this origin');
		}

		// Allow the request to proceed
		return true;
	}
}
