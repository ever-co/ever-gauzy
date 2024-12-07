import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract user information from the request object.
 *
 * @param data - Optional data parameter (not used in this implementation).
 * @param ctx - The execution context from which to extract the request object.
 * @returns The user object from the request, or an empty object if not found.
 */
export const UserDecorator = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
	const request = ctx.switchToHttp().getRequest();
	return request.user || {};
});
