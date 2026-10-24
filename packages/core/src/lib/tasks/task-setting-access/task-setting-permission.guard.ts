import { CanActivate, ContextType, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ModuleRef, Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Cache } from 'cache-manager';
import { In } from 'typeorm';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../../core/context';
import { PermissionGuard } from '../../shared/guards';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import {
	ITaskSettingRows,
	ITaskSettingWrite,
	TASK_SETTING_WRITE_METADATA,
	TaskSettingWriteKind
} from './task-setting-write.decorator';
import { ITeamMembershipReader, teamsManagedBy } from './task-setting-team-managers';

/** What a write names: the stored row's id, the payload, and the board order a reorder sends. */
interface ITaskSettingPayload {
	id?: ID;
	body?: Record<string, unknown> | null;
	reorder?: Array<{ id?: ID }> | null;
}

/**
 * The permission guard of the task-setting writes — statuses, priorities, sizes, versions, related-issue types and
 * issue types, on REST and GraphQL alike.
 *
 * A holder of the route's permission (`ORG_TASK_SETTING`) writes every task setting, exactly as `PermissionGuard`
 * decides it. Owner decision 2(b) (2026-10-23) adds one more way in: a row that belongs to a team (`organizationTeamId`
 * set) may also be written by a manager of that team, which is what Ever Teams' team settings do with the same API.
 * The organization's own rows — no team — still need `ORG_TASK_SETTING`.
 *
 * Every row a write touches must belong to a team the caller manages ({@link teamsManagedBy}): the team a new row is
 * filed under; a stored row's team and, when the write moves it, the team it moves to (moving one out to the
 * organization is refused); every row of a reorder; and for a default, the stored row's team and the scope whose
 * defaults it clears. Anything else — a team the caller does not manage, a row of no team, a row the caller cannot
 * read — falls through to `PermissionGuard`, which refuses a caller without the grant as before. The route names its
 * rows with {@link TaskSettingWrite}; a route without that metadata is `PermissionGuard` alone.
 *
 * Runs before the validation pipes, so it reads the payload as sent: a team named in a member the DTO would strip
 * still has to be one the caller manages, which can only refuse more, never less.
 */
@Injectable()
export class TaskSettingPermissionGuard extends PermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) _cacheManager: Cache,
		readonly _reflector: Reflector,
		readonly _rolePermissionService: RolePermissionService,
		private readonly _moduleRef: ModuleRef
	) {
		super(_cacheManager, _reflector, _rolePermissionService);
	}

	/**
	 * Lets a holder of the route's permission through as `PermissionGuard` does, and a manager of every team the write
	 * touches through without it.
	 *
	 * @param context - The execution context of the request or the GraphQL field.
	 * @returns Whether the write may run.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const stated =
			this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, [
				context.getHandler(),
				context.getClass()
			]) ?? [];

		// A holder of the grant, as the request's role state states it, takes the permission path straight away
		if (!stated.length || RequestContext.hasAnyPermission(stated)) {
			return super.canActivate(context);
		}

		if (await this.writesOnlyInManagedTeams(context)) {
			return true;
		}

		return super.canActivate(context);
	}

	/**
	 * Whether every row the write touches belongs to a team the caller manages.
	 *
	 * @param context - The execution context.
	 * @returns True when the caller manages all of them; false when any row has no team, belongs to a team the caller
	 * does not manage, or cannot be read.
	 */
	private async writesOnlyInManagedTeams(context: ExecutionContext): Promise<boolean> {
		const write = this._reflector.get<ITaskSettingWrite>(TASK_SETTING_WRITE_METADATA, context.getHandler());
		// The caller's own employee: `currentEmployeeId()` answers null for a CHANGE_SELECTED_EMPLOYEE holder
		const employeeId = RequestContext.currentUser()?.employeeId;
		if (!write || !employeeId) {
			return false;
		}

		const teams = await this.teamsWritten(write, this.payloadOf(context, write.kind));
		if (!teams?.length || !teams.every((team) => isNotEmpty(team))) {
			return false;
		}

		try {
			const managed = await teamsManagedBy(this.teamMemberships(), employeeId, [...new Set(teams)]);
			return teams.every((team) => managed.has(team));
		} catch {
			// Memberships that cannot be read manage nothing: the permission decides
			return false;
		}
	}

	/**
	 * The teams a write touches, `null` among them for a row of no team.
	 *
	 * @param write - The route's metadata.
	 * @param payload - What the write names.
	 * @returns The teams, or `null` when a row it names cannot be read in the caller's tenant (or there is none).
	 */
	private async teamsWritten(
		write: ITaskSettingWrite,
		payload: ITaskSettingPayload
	): Promise<Array<ID | null> | null> {
		try {
			const rows = this._moduleRef.get(write.rows, { strict: false }) as unknown as ITaskSettingRows;

			switch (write.kind) {
				case 'create':
					return [teamOf(payload.body)];
				case 'update': {
					const stored = await rows.findOneByIdString(payload.id);
					return namesTeam(payload.body)
						? [stored.organizationTeamId ?? null, teamOf(payload.body)]
						: [stored.organizationTeamId ?? null];
				}
				case 'markAsDefault': {
					// The service completes a scope that names no team from the row itself
					const stored = await rows.findOneByIdString(payload.id);
					const scope = teamOf(payload.body);
					return scope ? [stored.organizationTeamId ?? null, scope] : [stored.organizationTeamId ?? null];
				}
				case 'reorder': {
					const ids = [...new Set((payload.reorder ?? []).map((item) => item?.id).filter(Boolean))];
					if (!ids.length) {
						return null;
					}
					const stored = await rows.find({ where: { id: In(ids) } });
					return stored.length === ids.length ? stored.map((row) => row.organizationTeamId ?? null) : null;
				}
				case 'stored':
				default: {
					// A withdrawn row is the one a recover names, and may be the one a delete names
					const stored = await rows.findOneByIdString(payload.id, { withDeleted: true });
					return [stored.organizationTeamId ?? null];
				}
			}
		} catch {
			// A row the caller cannot read in their tenant is no team of theirs: the permission decides
			return null;
		}
	}

	/**
	 * What the write names, from the REST request or the GraphQL field's arguments.
	 *
	 * @param context - The execution context.
	 * @param kind - How the write names its rows.
	 * @returns The id, payload and order the write carries.
	 */
	private payloadOf(context: ExecutionContext, kind: TaskSettingWriteKind): ITaskSettingPayload {
		if (context.getType<ContextType | 'graphql'>() === 'graphql') {
			const args = GqlExecutionContext.create(context).getArgs() ?? {};

			switch (kind) {
				case 'create':
					return { body: args.input };
				case 'update':
					return { id: args.input?.id, body: args.input };
				case 'markAsDefault':
					return { id: args.id, body: args.scope };
				case 'reorder':
					return { reorder: args.reorder };
				case 'stored':
				default:
					return { id: args.id };
			}
		}

		const request = this.getRequest(context);
		// Express types a route parameter as `string | string[]`; a list is never a row id.
		const id = request.params?.id;
		return { id: typeof id === 'string' ? id : undefined, body: request.body, reorder: request.body?.reorder };
	}

	/**
	 * The team-member reads, from the module graph.
	 *
	 * Resolved when first needed, and required rather than imported: the team-member service reaches the task module
	 * through its own dependencies (`TaskService`), and this guard is loaded by the task-setting controllers, so a
	 * top-level import would close an import cycle while their decorators are still being evaluated.
	 *
	 * @returns The tenant-scoped team-member service.
	 */
	protected teamMemberships(): ITeamMembershipReader {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { OrganizationTeamEmployeeService } = require(
			'../../organization-team-employee/organization-team-employee.service'
		);
		return this._moduleRef.get(OrganizationTeamEmployeeService, { strict: false }) as ITeamMembershipReader;
	}
}

/** The team a payload files a row under or moves it to: `organizationTeamId`, or `organizationTeam.id`. */
function teamOf(body: Record<string, unknown> | null | undefined): ID | null {
	const team = body?.['organizationTeam'] as { id?: ID } | null | undefined;
	return (body?.['organizationTeamId'] as ID) ?? team?.id ?? null;
}

/** Whether a payload names a team at all — a member present with any value, `null` (no team) included. */
function namesTeam(body: Record<string, unknown> | null | undefined): boolean {
	return (
		!!body &&
		typeof body === 'object' &&
		(Object.prototype.hasOwnProperty.call(body, 'organizationTeamId') ||
			Object.prototype.hasOwnProperty.call(body, 'organizationTeam'))
	);
}
