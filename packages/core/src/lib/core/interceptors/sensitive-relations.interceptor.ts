import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
	SENSITIVE_RELATIONS_KEY,
	SENSITIVE_RELATIONS_ROOT_KEY,
	SensitiveRelationConfig
} from '../decorators/sensitive-relations.decorator';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';

/**
 * Returns the required permission for a given relation path by traversing the config tree.
 * Supports nested relations (e.g. 'organization.employees.user').
 *
 * @param config - The sensitive relations config object (nested structure)
 * @param relationPath - The relation path requested (dot notation)
 * @returns The required permission as a PermissionsEnum, or null if none is required
 */
function getRequiredPermissionForRelation(
	config: SensitiveRelationConfig,
	relationPath: string
): PermissionsEnum | null {
	const pathParts = relationPath.split('.');
	let current: SensitiveRelationConfig | PermissionsEnum | null = config;

	for (const part of pathParts) {
		if (!current || typeof current !== 'object') return null;
		const value = current[part];

		if (typeof value === 'object' && value !== null) {
			if ('_self' in value && value._self) {
				return value._self as PermissionsEnum;
			}
			current = value as SensitiveRelationConfig;
		} else if (Object.values(PermissionsEnum).includes(value as PermissionsEnum)) {
			return value as PermissionsEnum;
		} else {
			return null;
		}
	}
	return null;
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
		const handler = context.getHandler();
		const controller = context.getClass();
		const config: SensitiveRelationConfig =
			this.reflector.get(SENSITIVE_RELATIONS_KEY, handler) ||
			this.reflector.get(SENSITIVE_RELATIONS_KEY, controller);

		const rootKey: string | undefined =
			this.reflector.get(SENSITIVE_RELATIONS_ROOT_KEY, handler) ||
			this.reflector.get(SENSITIVE_RELATIONS_ROOT_KEY, controller);

		if (!config) {
			return next.handle();
		}

		// Use the root if provided
		let configToUse: SensitiveRelationConfig = config;
		if (rootKey) {
			const maybeSubConfig = config[rootKey];
			if (maybeSubConfig && typeof maybeSubConfig === 'object') {
				configToUse = maybeSubConfig as SensitiveRelationConfig;
			} // otherwise, keep the full config (no early return)
		}

		// Extract requested relations from the query or body
		const request = context.switchToHttp().getRequest();
		let relations = request.query?.relations || request.body?.relations || [];

		// Sanitize relations input
		if (typeof relations === 'string') {
			relations = relations.trim();
		}
		// Support both array and comma-separated string
		const relationsArray = Array.isArray(relations)
			? relations
			: typeof relations === 'string'
			? relations.split(',')
			: [];

		for (const rel of relationsArray) {
			let requiredPermission: PermissionsEnum | null = null;
			if (rootKey) {
				// If relation starts with rootKey, remove it for lookup in the sub-config
				let relationToCheck = rel;
				if (rel.startsWith(rootKey + '.')) {
					relationToCheck = rel.slice(rootKey.length + 1);
					if (relationToCheck.startsWith('.')) {
						relationToCheck = relationToCheck.slice(1);
					}
				}
				requiredPermission = getRequiredPermissionForRelation(configToUse, relationToCheck);
			} else {
				// Without rootKey, only allow direct lookup (no dot notation)
				if (Object.prototype.hasOwnProperty.call(configToUse, rel)) {
					const value = configToUse[rel];
					if (typeof value === 'object' && value !== null && '_self' in value && value._self) {
						requiredPermission = value._self as PermissionsEnum;
					} else if (Object.values(PermissionsEnum).includes(value as PermissionsEnum)) {
						requiredPermission = value as PermissionsEnum;
					}
				}
			}
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
