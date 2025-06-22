import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { SENSITIVE_RELATIONS_KEY, SensitiveRelationConfig } from '../decorators/sensitive-relations.decorator';
import { RequestContext } from '../context';

/**
 * Returns the required permission for a given relation path by traversing the config tree.
 * Supports nested relations (e.g. 'organization.employees.user').
 *
 * @param config - The sensitive relations config object (nested structure)
 * @param relationPath - The relation path requested (dot notation)
 * @returns The required permission as a string, or null if none is required
 */
function getRequiredPermissionForRelation(config: SensitiveRelationConfig, relationPath: string): string | null {
	const pathParts = relationPath.split('.');
	let current = config;
	let requiredPermission: string | null = null;

	for (const part of pathParts) {
		if (!current || typeof current !== 'object') break;
		if (current[part]) {
			const value = current[part];
			if (typeof value === 'object' && value !== null) {
				if (value._self) {
					requiredPermission = value._self as string;
				}
				current = value as SensitiveRelationConfig;
			} else {
				requiredPermission = value as string;
				break;
			}
		} else {
			break;
		}
	}
	return requiredPermission;
}

/**
 * Interceptor to protect sensitive entity relations based on user permissions.
 *
 * Usage:
 *   - Apply @SensitiveRelations(config) on a controller or route handler.
 *   - Apply @UseInterceptors(SensitiveRelationsInterceptor) on the same controller or handler.
 *   - The config is a nested object mapping relation paths to required permissions.
 *
 * At runtime, the interceptor checks the requested relations (from req.query.relations or req.body.relations).
 * For each relation, it traverses the config tree to find if a permission is required.
 * If a required permission is found and the user does not have it, a 403 Forbidden is thrown.
 *
 * This does NOT modify the query or filter the relations, it only blocks access if not permitted.
 */
@Injectable()
export class SensitiveRelationsInterceptor implements NestInterceptor {
	constructor(private readonly reflector: Reflector) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Retrieve the sensitive relations config from the handler or controller
		const handler = context.getHandler();
		const controller = context.getClass();
		const config: SensitiveRelationConfig =
			this.reflector.get(SENSITIVE_RELATIONS_KEY, handler) ||
			this.reflector.get(SENSITIVE_RELATIONS_KEY, controller);

		if (!config) {
			return next.handle();
		}

		// Extract requested relations from the query or body
		const request = context.switchToHttp().getRequest();
		const relations = request.query?.relations || request.body?.relations || [];
		// Support both array and comma-separated string
		const relationsArray = Array.isArray(relations)
			? relations
			: typeof relations === 'string'
			? relations.split(',')
			: [];

		// For each requested relation, check if a permission is required and if the user has it
		for (const rel of relationsArray) {
			const requiredPermission = getRequiredPermissionForRelation(config, rel);
			if (requiredPermission) {
				if (!RequestContext.hasPermission(requiredPermission)) {
					throw new ForbiddenException(
						`Access to the sensitive relation '${rel}' is forbidden. Required permission: '${requiredPermission}'.`
					);
				}
			}
		}

		return next.handle();
	}
}
