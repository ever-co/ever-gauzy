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
import { normalizeRelationsToPaths } from '../utils';
import { getRequiredPermissionForRelation } from '../util/sensitive-relations.helper';

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
		const relations = request.query?.relations || request.body?.relations || [];

		// Canonicalize EVERY representation of `relations` into dot-notated paths: a comma-separated
		// string, the legacy string array the Angular clients send as `relations[0]=…`, TypeORM v1's
		// nested object form — which Express's extended query parser builds from
		// `?relations[organization][payments][invoice]=x` — and any mixture of them.
		//
		// Reading only the array and string forms is what made this interceptor a no-op against the
		// object form (GHSA-c3cj-m3xm-7j5h): the ternary chain that used to live here fell through to
		// an empty array, so the loop below ran zero times while TypeORM happily joined and selected
		// the protected rows. The canonicalizing walk also emits every intermediate prefix, so the
		// config is consulted at each depth, and it fails closed on odd leaf values and on
		// prototype-polluting keys.
		const validRelations = normalizeRelationsToPaths(relations);

		for (const rel of validRelations) {
			let requiredPermission: PermissionsEnum | null = null;
			if (rootKey) {
				// If relation starts with rootKey followed by a dot, remove the prefix for sub-config lookup
				let relationToCheck = rel;
				const rootKeyPrefix = `${rootKey}.`;
				if (rel.startsWith(rootKeyPrefix)) {
					relationToCheck = rel.slice(rootKeyPrefix.length);
					// Trim any remaining leading dots from malformed input
					relationToCheck = relationToCheck.replace(/^\.+/, '');
				}
				requiredPermission = getRequiredPermissionForRelation(configToUse, relationToCheck);
			} else {
				requiredPermission = getRequiredPermissionForRelation(configToUse, rel);
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
