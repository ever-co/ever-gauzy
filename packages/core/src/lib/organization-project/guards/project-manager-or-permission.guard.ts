import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { RequestContext } from '../../core/context';
import { PermissionGuard } from '../../shared/guards';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { OrganizationProjectService } from '../organization-project.service';

// Per-request trace lines: printed at debug level, i.e. only when LOG_LEVEL is debug/verbose (or unset).
const logger = new Logger('ProjectManagerOrPermissionGuard');

@Injectable()
export class ProjectManagerOrPermissionGuard extends PermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) _cacheManager: Cache,
		readonly _reflector: Reflector,
		readonly _rolePermissionService: RolePermissionService,
		readonly _projectService: OrganizationProjectService
	) {
		super(_cacheManager, _reflector, _rolePermissionService);
	}

	/**
	 * Determines if the current user has access to the project.
	 * @param context - The execution context of the request.
	 * @returns A boolean indicating whether the user can proceed.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const projectId = this.projectIdOf(context);

		// Get employeeId from RequestContext
		const employeeId = RequestContext.currentEmployeeId();

		// If either employeeId or projectId is missing, defer to PermissionGuard
		if (!employeeId || !projectId) {
			logger.debug('⚠️ Missing employeeId or projectId, deferring to PermissionGuard.');
			return super.canActivate(context);
		}

		// A third-party OAuth-app token takes the manager's way in only when its approved scopes reach the route's
		// permissions (owner decision Q12): a read-only app never edits a project through its user's management.
		if (!this.oauthAppScopesReachRoute(context)) {
			return super.canActivate(context);
		}

		// Check if the user is a project manager
		const isManager = await this._projectService.isManagerOfProject(projectId, employeeId);
		if (isManager) {
			console.log(`✅ Access granted: User (employeeId: ${employeeId}) is manager of project ${projectId}.`);
			return true;
		}

		// If the user is not a manager, delegate the check to PermissionGuard
		return super.canActivate(context);
	}

	/**
	 * The project the request acts on, as the REST route and the GraphQL field name it:
	 *
	 * - REST: the `:id` of the path (`GET /:id`, `PUT /:id`, `PUT /:id/archive`, `PUT /setting/:id`, `DELETE /:id`…).
	 * - GraphQL: the field's `id` argument (`organizationProject`, `deleteOrganizationProject`,
	 *   `archiveOrganizationProject`, `updateOrganizationProjectSetting`…), or the `id` of its `input` for
	 *   `updateOrganizationProject`, whose input is the one input type that names a project. A field that names no
	 *   project (`createOrganizationProject`, the lists, `isOrganizationProjectManager`'s `projectId`) gets none, as
	 *   its route does.
	 *
	 * @param context - The execution context of the request.
	 * @returns The project id, or undefined when the request names none.
	 */
	private projectIdOf(context: ExecutionContext): string | undefined {
		if (typeof context.getType === 'function' && context.getType<GqlContextType>() === 'graphql') {
			const args = (GqlExecutionContext.create(context).getArgs() ?? {}) as Record<string, unknown>;
			const input = args.input as Record<string, unknown> | undefined;
			const id = args.id ?? input?.id;
			return typeof id === 'string' && id ? id : undefined;
		}

		// The id could be string or string[]
		const param = super.getRequest(context)?.params?.id;
		return Array.isArray(param) ? param[0] : param;
	}
}
