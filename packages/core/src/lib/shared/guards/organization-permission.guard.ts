import { MultiORM, environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Inject, Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Brackets, WhereExpressionBuilder } from 'typeorm';
import { verify } from 'jsonwebtoken';
import camelcase from 'camelcase';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isEmpty, PERMISSIONS_METADATA, removeDuplicates } from '@gauzy/common';
import { RequestContext } from './../../core/context';
import { MikroOrmEmployeeRepository, TypeOrmEmployeeRepository } from '../../employee/repository';
import { MultiORMEnum, getORMType } from '../../core/utils';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

@Injectable()
export class OrganizationPermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		readonly _reflector: Reflector,
		readonly _typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly _mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) {}

	/**
	 * Checks if the user is authorized based on specified permissions.
	 * @param context The execution context.
	 * @returns A promise that resolves to a boolean indicating authorization status.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		console.log('OrganizationPermissionGuard canActivate called');

		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];

		const permissions =
			removeDuplicates(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// If no specific permissions are required, consider it authorized
		if (isEmpty(permissions)) {
			return true;
		}

		let isAuthorized: boolean = false;

		// Check user authorization
		const token = RequestContext.currentToken();

		const { id, role, employeeId } = verify(token, env.JWT_SECRET) as {
			id: string;
			role: string;
			employeeId: string;
		};

		// Check if super admin role is allowed from the .env file
		if (env.allowSuperAdminRole && RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
			return true;
		}

		// Check permissions based on user role
		if (role === RolesEnum.EMPLOYEE) {
			const tenantId = RequestContext.currentTenantId();

			const cacheKey = `orgPermissions_${tenantId}_${employeeId}_${permissions.join('_')}`;

			console.log(
				`Guard: Checking Org Permissions for Employee ID: ${employeeId} from Cache with key ${cacheKey}`
			);

			const fromCache = await this.cacheManager.get<boolean | null>(cacheKey);

			if (fromCache == null) {
				console.log('Organization Permissions NOT loaded from Cache with key:', cacheKey);

				// Check if user has the required permissions
				isAuthorized = await this.checkOrganizationPermission(tenantId, employeeId, permissions);

				const ttl = 5 * 60 * 1000; // 5 minutes caching period for Organization Permissions
				await this.cacheManager.set(cacheKey, isAuthorized, ttl);
			} else {
				isAuthorized = fromCache;
				console.log(`Organization Permissions loaded from Cache with key: ${cacheKey}. Value: ${isAuthorized}`);
			}
		} else {
			// For non-employee roles, consider it authorized
			// TODO: why!? This should be handled differently I think...
			// If it's not Employee, but say Viewer, it should still check the permissions...
			isAuthorized = true;
		}

		if (!isAuthorized) {
			// Log unauthorized access attempts
			console.log(
				`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Employee ID: ${employeeId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		} else {
			console.log(
				`Access granted.  User ID: ${id}, Role: ${role}, Employee ID: ${employeeId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		}

		return isAuthorized;
	}

	/**
	 * Checks if the employee has at least one specified permission in the associated organization.
	 * @param employeeId - The ID of the employee to check permissions for.
	 * @param permissions - An array of permission strings to check.
	 * @returns A Promise that resolves to a boolean indicating if at least one permission is allowed in the organization.
	 */
	async checkOrganizationPermission(tenantId: string, employeeId: string, permissions: string[]): Promise<boolean> {
		try {
			switch (ormType) {
				case MultiORMEnum.MikroORM:
					try {
						// Create a QueryBuilder for the Employee entity
						const mikroOrmQueryBuilder = this._mikroOrmEmployeeRepository.createQueryBuilder('employee');
						// Join with another table/entity, 'organization'
						mikroOrmQueryBuilder.innerJoin(`${mikroOrmQueryBuilder.alias}.organization`, 'organization');
						// Add a condition for the employee ID
						mikroOrmQueryBuilder.where({ id: employeeId });
						// Add a condition for the tenant ID
						mikroOrmQueryBuilder.andWhere({ tenantId: tenantId });
						// Directly add the OR conditions to the query if permissions array is not empty
						if (permissions.length > 0) {
							const orConditions = permissions.map((permission: string) => {
								const field = `organization.${camelcase(permission)}`;
								return { [field]: true };
							});
							// Use OR condition for each permission
							mikroOrmQueryBuilder.andWhere({ $or: orConditions });
						}
						// Execute the query and get the count
						const count = await mikroOrmQueryBuilder.getCount();
						// Returns true if at least one record is found, false otherwise
						return count > 0;
					} catch (error) {
						console.log(
							`Error occurred while checking ${MultiORMEnum.TypeORM} organization permission:`,
							error
						);
						return false;
					}
				case MultiORMEnum.TypeORM:
					try {
						// Create a query builder for the 'employee' entity
						const typeOrmQueryBuilder = this._typeOrmEmployeeRepository.createQueryBuilder('employee');
						// (Optional) Inner join with another table/entity, for example, 'organization'
						typeOrmQueryBuilder.innerJoin(`${typeOrmQueryBuilder.alias}.organization`, 'organization');
						// Add a condition for the employee ID
						typeOrmQueryBuilder.where(`${typeOrmQueryBuilder.alias}.id = :employeeId`, { employeeId });
						// Add a condition for the tenant ID
						typeOrmQueryBuilder.andWhere(`${typeOrmQueryBuilder.alias}.tenantId = :tenantId`, { tenantId });
						// Use OR condition for each permission
						typeOrmQueryBuilder.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								permissions.forEach((permission) => {
									qb.orWhere(`organization.${camelcase(permission)} = true`);
								});
							})
						);
						// Execute the query
						const count = await typeOrmQueryBuilder.getCount(); // Execute the query and get the count
						// Returns true if at least one permission is allowed in the organization, false otherwise
						return count > 0;
					} catch (error) {
						console.log(
							`Error occurred while checking ${MultiORMEnum.TypeORM} organization permission:`,
							error
						);
						return false;
					}
				default:
					break;
			}
		} catch (error) {
			// Handle any potential errors, log, and optionally rethrow or return a default value.
			console.error('Error occurred while checking organization permission:', error);
			return false;
		}
	}
}
