import { MultiORM, environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Inject, Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Brackets, EntityTarget, WhereExpressionBuilder } from 'typeorm';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID, IOrganization, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { deduplicate, isEmpty, isNotEmpty } from '@gauzy/utils';
import { RequestContext } from './../../core/context';
import {
	IOrganizationPolicyTarget,
	ORGANIZATION_POLICY_TARGET_METADATA
} from '../decorators/organization-policy-target.decorator';
import { MultiORMEnum, getORMType } from '../../core/utils';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { MikroOrmOrganizationRepository } from '../../organization/repository/mikro-orm-organization.repository';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * The only permissions this guard is able to translate into an organization time-tracking policy
 * column.
 *
 * The previous implementation built the column name with `camelcase(permission)` and interpolated
 * it straight into SQL. An explicit allow list keeps the guard from silently checking a column that
 * does not exist (which would make the whole check throw and, worse, tempts a future route into
 * passing an unrelated permission to this guard). Anything outside this map is refused.
 */
export const ORGANIZATION_POLICY_COLUMNS: Readonly<Record<string, keyof IOrganization>> = Object.freeze({
	[PermissionsEnum.ALLOW_MANUAL_TIME]: 'allowManualTime' as keyof IOrganization,
	[PermissionsEnum.ALLOW_MODIFY_TIME]: 'allowModifyTime' as keyof IOrganization,
	[PermissionsEnum.ALLOW_DELETE_TIME]: 'allowDeleteTime' as keyof IOrganization
});

@Injectable()
export class OrganizationPermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		readonly _reflector: Reflector,
		readonly _typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly _mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		readonly _typeOrmOrganizationRepository: TypeOrmOrganizationRepository,
		readonly _mikroOrmOrganizationRepository: MikroOrmOrganizationRepository
	) {}

	/**
	 * Enforces the organization's time-tracking policy toggles (allowManualTime / allowModifyTime /
	 * allowDeleteTime) for EVERY role.
	 *
	 * Historically the policy was only consulted when the caller's role was exactly `EMPLOYEE`;
	 * every other role fell into an unconditional `isAuthorized = true` branch, so the organization
	 * setting was void for the very roles it matters most for (GHSA-rmq9-85v7-f365). The check is
	 * now role agnostic and resolves the organization(s) the request touches instead of the caller's
	 * role.
	 *
	 * @param context The execution context.
	 * @returns A promise that resolves to a boolean indicating authorization status.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];

		const permissions =
			deduplicate(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// Fail closed: this guard exists to evaluate an organization policy. A route that applies it
		// without declaring which policy to evaluate cannot reach a verdict, so it must not get the
		// permissive one.
		if (isEmpty(permissions)) {
			console.log('OrganizationPermissionGuard: no permissions declared on the route, access denied');
			return false;
		}

		// Translate the declared permissions into organization policy columns, refusing anything
		// this guard does not know how to evaluate.
		const columns: string[] = [];

		for (const permission of permissions) {
			const column = ORGANIZATION_POLICY_COLUMNS[permission as string];

			if (!column) {
				console.log(
					`OrganizationPermissionGuard: permission ${permission} is not an organization policy, access denied`
				);
				return false;
			}

			columns.push(column);
		}

		// Authorize from the request's DB-fresh user, not from the bearer token's claims. The `role`
		// claim is frozen at issuance, so decoding it here meant a demoted user kept their former role
		// for the token's whole lifetime (GHSA-m8xc-8pwr-89fj). `employeeId` is the claim JwtStrategy
		// already validated against the database before attaching the user.
		const user = RequestContext.currentUser();

		// No authenticated caller means no verdict can be reached: deny.
		if (!user) {
			console.log('OrganizationPermissionGuard: no authenticated user on the request, access denied');
			return false;
		}

		const id: string | undefined = user.id;
		const role: string | null = RequestContext.currentRoleName();
		const employeeId: string | undefined = user.employeeId ?? undefined;

		// No resolvable role (the user's roleId is NULL, the role row is gone, or its lookup returned
		// nothing) means no verdict can be reached either.
		if (!role) {
			console.log(
				`Unauthorized access blocked: User ID: ${id}, Role: unresolved, Permissions Checked: ${permissions.join(', ')}`
			);
			return false;
		}

		// Check if super admin role is allowed from the .env file
		if (env.allowSuperAdminRole && RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
			return true;
		}

		const tenantId = RequestContext.currentTenantId();

		if (isEmpty(tenantId)) {
			console.log('OrganizationPermissionGuard: no tenant on the request, access denied');
			return false;
		}

		// Resolve every organization whose policy has to allow this request.
		const organizationIds = await this.resolveOrganizationIds(context, tenantId, role, employeeId);

		if (organizationIds === null || isEmpty(organizationIds)) {
			console.log(
				`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Employee ID: ${employeeId}, no organization could be resolved for the organization policy check`
			);
			return false;
		}

		const cacheKey = `orgPermissions_${tenantId}_${organizationIds.join('_')}_${permissions.join('_')}`;

		let isAuthorized = await this.cacheManager.get<boolean | null>(cacheKey);

		if (isAuthorized == null) {
			isAuthorized = await this.checkOrganizationPermission(tenantId, organizationIds, columns);

			const ttl = 5 * 60 * 1000; // 5 minutes caching period for Organization Permissions
			await this.cacheManager.set(cacheKey, isAuthorized, ttl);
		}

		if (!isAuthorized) {
			// Log unauthorized access attempts
			console.log(
				`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Employee ID: ${employeeId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		}

		return isAuthorized;
	}

	/**
	 * Works out which organizations must allow the requested action.
	 *
	 * Every resolved organization has to permit the action (the check below counts the matching
	 * rows and requires all of them), so adding a candidate can only ever narrow the verdict.
	 *
	 * @param context The execution context, used to read the organization the request targets.
	 * @param tenantId The caller's tenant.
	 * @param role The caller's role name, taken from the verified JWT.
	 * @param employeeId The caller's employee id, taken from the verified JWT.
	 * @returns The organization ids to check, or `null` when the guard cannot reach a verdict.
	 */
	private async resolveOrganizationIds(
		context: ExecutionContext,
		tenantId: ID,
		role: string | undefined,
		employeeId: string | undefined
	): Promise<ID[] | null> {
		const organizationIds = new Set<ID>();

		if (isNotEmpty(employeeId)) {
			// The caller acts as an employee: the organization of their own employee record always
			// has to allow the action, exactly as before this fix.
			const employeeOrganizationId = await this.findEmployeeOrganizationId(tenantId, employeeId as ID);

			if (!employeeOrganizationId) {
				// The employee id on the token does not resolve inside the caller's tenant.
				return null;
			}

			organizationIds.add(employeeOrganizationId);
		} else if (role === RolesEnum.EMPLOYEE) {
			// An employee-role caller with no employee record was refused before this fix (the
			// employee lookup matched nothing); keep refusing them rather than falling through to
			// the request-supplied organization.
			return null;
		}

		// The organization of the record the route mutates, when the route declares one. The request
		// cannot name that organization for us: a caller with no employee record could otherwise name a
		// permissive organization while addressing a record of an organization whose policy is off.
		const target = this._reflector.get<IOrganizationPolicyTarget | undefined>(
			ORGANIZATION_POLICY_TARGET_METADATA,
			context.getHandler()
		);

		if (target) {
			const targetOrganizationId = await this.findTargetOrganizationId(context, tenantId, target);

			if (!targetOrganizationId) {
				// The record does not exist in the caller's tenant (or the id is missing).
				return null;
			}

			organizationIds.add(targetOrganizationId);
		}

		// The organization the request itself targets. It is validated against the caller's tenant
		// by the policy query below, which only counts rows of this tenant.
		const requestOrganizationId = this.extractRequestOrganizationId(context);

		if (requestOrganizationId) {
			organizationIds.add(requestOrganizationId);
		}

		if (organizationIds.size === 0) {
			// Fall back to the organization pinned on the JWT. `jwt.strategy` only sets it after
			// verifying that the user has an active membership of that organization.
			const currentOrganizationId = RequestContext.currentOrganizationId();

			if (currentOrganizationId) {
				organizationIds.add(currentOrganizationId);
			}
		}

		return [...organizationIds].sort();
	}

	/**
	 * Reads the organization id the request targets from the body, the query string or the route
	 * params, without trusting it: it is only ever used as a lookup key of a tenant-scoped query.
	 *
	 * @param context The execution context.
	 * @returns The organization id found on the request, or undefined.
	 */
	private extractRequestOrganizationId(context: ExecutionContext): ID | undefined {
		try {
			const request = context.switchToHttp().getRequest();

			const candidates = [
				request?.body?.organizationId,
				request?.query?.organizationId,
				request?.params?.organizationId
			];

			for (const candidate of candidates) {
				if (typeof candidate === 'string' && candidate.trim().length > 0) {
					return candidate;
				}
			}
		} catch (error) {
			console.log('OrganizationPermissionGuard: unable to read the request organization id', error);
		}

		return undefined;
	}

	/**
	 * Finds the organization of the record a route addresses by id, scoped to the caller's tenant.
	 *
	 * @param context The execution context, used to read the route param carrying the record id.
	 * @param tenantId The caller's tenant.
	 * @param target The entity and route param declared with `@OrganizationPolicyTarget()`.
	 * @returns The record's organization id, or undefined when the id is missing or the record is not
	 * in this tenant.
	 */
	private async findTargetOrganizationId(
		context: ExecutionContext,
		tenantId: ID,
		target: IOrganizationPolicyTarget
	): Promise<ID | undefined> {
		try {
			const id = context.switchToHttp().getRequest()?.params?.[target.param];

			if (typeof id !== 'string' || id.trim().length === 0) {
				return undefined;
			}

			switch (ormType) {
				case MultiORMEnum.MikroORM: {
					const record: any = await this._mikroOrmOrganizationRepository
						.getEntityManager()
						.findOne(target.entity as any, { id, tenantId }, { fields: ['id', 'organizationId'] as any });

					return record?.organizationId ?? undefined;
				}
				case MultiORMEnum.TypeORM: {
					const record = await this._typeOrmOrganizationRepository.manager.findOne(
						target.entity as EntityTarget<{ id: ID; tenantId: ID; organizationId: ID }>,
						{
							where: { id, tenantId },
							select: { id: true, organizationId: true }
						}
					);

					return record?.organizationId ?? undefined;
				}
				default:
					return undefined;
			}
		} catch (error) {
			console.log('Error occurred while resolving the organization of the target record:', error);
			return undefined;
		}
	}

	/**
	 * Finds the organization of an employee, scoped to the caller's tenant.
	 *
	 * @param tenantId The caller's tenant.
	 * @param employeeId The employee to resolve.
	 * @returns The employee's organization id, or undefined when the employee is not in this tenant.
	 */
	private async findEmployeeOrganizationId(tenantId: ID, employeeId: ID): Promise<ID | undefined> {
		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM: {
					const employee = await this._mikroOrmEmployeeRepository
						.createQueryBuilder('employee')
						.where({ id: employeeId })
						.andWhere({ tenantId })
						.getSingleResult();

					return employee?.organizationId ?? undefined;
				}
				case MultiORMEnum.TypeORM: {
					const employee = await this._typeOrmEmployeeRepository.findOne({
						where: { id: employeeId, tenantId },
						// Object form: TypeORM 1.0 rejects the legacy string-array `select` syntax.
						select: { id: true, organizationId: true }
					});

					return employee?.organizationId ?? undefined;
				}
				default:
					return undefined;
			}
		} catch (error) {
			console.log('Error occurred while resolving the employee organization:', error);
			return undefined;
		}
	}

	/**
	 * Checks that EVERY given organization of the tenant enables at least one of the policy columns.
	 *
	 * The row count is compared with the number of requested organizations, so an organization that
	 * does not exist in this tenant (or has the policy switched off) makes the whole check fail.
	 *
	 * @param tenantId The caller's tenant.
	 * @param organizationIds The organizations whose policy must allow the action.
	 * @param columns The organization policy columns to OR together.
	 * @returns A Promise resolving to true only when all organizations allow the action.
	 */
	async checkOrganizationPermission(tenantId: ID, organizationIds: ID[], columns: string[]): Promise<boolean> {
		if (isEmpty(organizationIds) || isEmpty(columns)) {
			return false;
		}

		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					try {
						// Create a QueryBuilder for the Organization entity
						const mikroOrmQueryBuilder =
							this._mikroOrmOrganizationRepository.createQueryBuilder('organization');
						// Restrict to the requested organizations of the caller's tenant
						mikroOrmQueryBuilder.where({ id: { $in: organizationIds } });
						mikroOrmQueryBuilder.andWhere({ tenantId });
						// Use OR condition for each policy column
						mikroOrmQueryBuilder.andWhere({ $or: columns.map((column: string) => ({ [column]: true })) });
						// Execute the query and get the count
						const count = await mikroOrmQueryBuilder.getCount();
						// Every requested organization has to allow the action
						return count === organizationIds.length;
					} catch (error) {
						console.log(
							`Error occurred while checking ${MultiORMEnum.MikroORM} organization permission:`,
							error
						);
						return false;
					}
				case MultiORMEnum.TypeORM:
					try {
						// Create a query builder for the 'organization' entity
						const typeOrmQueryBuilder =
							this._typeOrmOrganizationRepository.createQueryBuilder('organization');
						// Restrict to the requested organizations of the caller's tenant
						typeOrmQueryBuilder.where(`${typeOrmQueryBuilder.alias}.id IN (:...organizationIds)`, {
							organizationIds
						});
						typeOrmQueryBuilder.andWhere(`${typeOrmQueryBuilder.alias}.tenantId = :tenantId`, { tenantId });
						// Use OR condition for each policy column
						typeOrmQueryBuilder.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								columns.forEach((column: string) => {
									qb.orWhere(`${typeOrmQueryBuilder.alias}.${column} = true`);
								});
							})
						);
						// Execute the query and get the count
						const count = await typeOrmQueryBuilder.getCount();
						// Every requested organization has to allow the action
						return count === organizationIds.length;
					} catch (error) {
						console.log(
							`Error occurred while checking ${MultiORMEnum.TypeORM} organization permission:`,
							error
						);
						return false;
					}
				default:
					return false;
			}
		} catch (error) {
			// Handle any potential errors, log, and fail closed.
			console.error('Error occurred while checking organization permission:', error);
			return false;
		}
	}
}
