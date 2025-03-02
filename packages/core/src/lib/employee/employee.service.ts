import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, FindManyOptions, FindOneOptions, In, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import {
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	IDateRangePicker,
	IEmployee,
	IFindMembersInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum, getDateRangeFormat, parseTypeORMFindToMikroOrm } from './../core/utils';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmEmployeeRepository } from './repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from './repository/type-orm-employee.repository';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService extends TenantAwareCrudService<Employee> {
	constructor(
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) {
		super(typeOrmEmployeeRepository, mikroOrmEmployeeRepository);
	}

	/**
	 * Finds members based on provided options.
	 *
	 * @param options - The options to filter members.
	 * @returns A pagination object containing the list of members and total count.
	 */
	async findMembers(options: IFindMembersInput): Promise<IPagination<IEmployee>> {
		const { organizationId, organizationTeamId, organizationProjectId } = options;
		const tenantId = RequestContext.currentTenantId() || options.tenantId;

		// Create a query builder for the Employee entity
		const query = this.typeOrmEmployeeRepository.createQueryBuilder('employee');
		query.leftJoin('employee.user', 'user');

		// Set pagination options and selected table properties/fields
		query.setFindOptions({
			select: {
				id: true,
				isActive: true,
				isArchived: true,
				userId: true,
				isOnline: true,
				isAway: true,
				user: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					imageUrl: true
				}
			},
			relations: { user: true }
		});

		// Organization Project ID
		if (organizationProjectId) {
			query.leftJoin('employee.projects', 'projects');
			query.andWhere('projects.organizationProjectId = :organizationProjectId', { organizationProjectId });
		}

		// Organization Team ID
		if (organizationTeamId) {
			query.leftJoin('employee.teams', 'teams');
			query.andWhere('teams.organizationTeamId = :organizationTeamId', { organizationTeamId });
		}

		// Apply filter conditions using TypeORM SelectQueryBuilder
		query.andWhere(
			new Brackets((web: WhereExpressionBuilder) => {
				// Filter by tenant ID, organization ID, isActive, and isArchived
				web.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				web.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
				web.andWhere(p(`"${query.alias}"."isActive" = :isActive`), { isActive: true });
				web.andWhere(p(`"${query.alias}"."isArchived" = :isArchived`), { isArchived: false });

				// Additional conditions for user isActive and isArchived
				web.andWhere(p(`"user"."isActive" = :isActive`), { isActive: true });
				web.andWhere(p(`"user"."isArchived" = :isArchived`), { isArchived: false });
			})
		);

		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Retrieves a list of active, non-archived employees based on provided employee IDs,
	 * organization ID, and tenant ID.
	 *
	 * @param {ID[]} employeeIds - Array of employee IDs to search for. Defaults to an empty array if not provided.
	 * @param {ID} organizationId - The ID of the organization to filter employees.
	 * @param {ID} tenantId - The ID of the tenant to filter employees.
	 * @returns {Promise<IEmployee[]>} - Promise resolving with an array of matching `IEmployee` objects.
	 *
	 * @throws {Error} - Throws an error if the retrieval process fails.
	 */
	async findActiveEmployeesByEmployeeIds(
		employeeIds: ID[] = [],
		organizationId: ID,
		tenantId: ID
	): Promise<IEmployee[]> {
		try {
			// Filter out any invalid values from the employee IDs array
			const filteredIds = employeeIds.filter(Boolean);

			// Fetch employees using filtered IDs, organizationId, and tenantId
			return await this.typeOrmEmployeeRepository.findBy({
				id: In(filteredIds),
				organizationId,
				tenantId,
				isActive: true,
				isArchived: false
			});
		} catch (error) {
			console.error('Error while retrieving employees', error);
			throw new Error(`Failed to retrieve employees: ${error}`);
		}
	}

	/**
	 * Finds employees based on an array of user IDs.
	 *
	 * @param userIds An array of user IDs.
	 * @param tenantId The ID of the tenant to filter employees.
	 * @returns A promise resolving to an array of employees.
	 */
	async findEmployeesByUserIds(userIds: ID[], tenantId: ID): Promise<IEmployee[]> {
		try {
			// Define the options for the query
			const options: FindManyOptions<Employee> = {
				// Construct the base where clause for querying employees by user IDs
				where: {
					userId: In(userIds), // Find employees with matching user IDs
					tenantId // Find employees in the same tenant
				}
			};

			// Execute the query based on the ORM type
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<Employee>(options);
					const employees = await this.mikroOrmRepository.find(where, mikroOptions);
					return employees.map((entity: Employee) => this.serialize(entity)) as Employee[];
				}
				case MultiORMEnum.TypeORM: {
					return await this.typeOrmRepository.find(options);
				}
				default:
					throw new Error(`Method not implemented for ORM type: ${this.ormType}`);
			}
		} catch (error) {
			console.error(`Error finding employees by user IDs: ${error.message}`);
			return []; // Return an empty array if an error occurs
		}
	}

	/**
	 * Finds the employeeId associated with a given userId.
	 *
	 * @param userId The ID of the user.
	 * @returns The employeeId or null if not found or in case of an error.
	 */
	async findEmployeeIdByUserId(userId: ID): Promise<string | null> {
		try {
			const tenantId = RequestContext.currentTenantId();
			// Construct the where clause based on whether tenantId is available
			const whereClause = {
				userId,
				isActive: true,
				isArchived: false,
				...(tenantId && { tenantId }) // Include tenantId if available
			};

			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const employee = await this.mikroOrmRepository.findOne(whereClause);
					return employee ? employee.id : null;
				}
				case MultiORMEnum.TypeORM: {
					const employee = await this.typeOrmRepository.findOne({ where: whereClause });
					return employee ? employee.id : null;
				}
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error(`Error finding employee by userId: ${error.message}`);
			return null;
		}
	}

	/**
	 * Finds an employee by user ID.
	 *
	 * @param userId The ID of the user to find.
	 * @returns A Promise resolving to the employee if found, otherwise null.
	 */
	async findOneByUserId(userId: ID, options?: FindOneOptions<Employee>): Promise<IEmployee | null> {
		try {
			// Define the base where clause
			const whereClause = {
				userId,
				isActive: true,
				isArchived: false
			};

			// Merge the existing where conditions in options, if any
			const queryOptions: FindOneOptions<Employee> = {
				...options,
				where: {
					...whereClause,
					...(options?.where || {}) // Merge with existing where options if present
				}
			};

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<Employee>(
						queryOptions as FindManyOptions
					);
					const item = await this.mikroOrmRepository.findOne(where, mikroOptions);
					return this.serialize(item as Employee);
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.findOne(queryOptions);
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.error(`Error finding employee by userId: ${error.message}`);
			return null;
		}
	}

	/**
	 * Retrieves all active employees with their associated user and organization details.
	 * @returns A Promise that resolves to an array of active employees.
	 */
	public async findAllActive(): Promise<IEmployee[]> {
		try {
			return await super.find({
				where: { isActive: true, isArchived: false },
				relations: { user: true, organization: true }
			});
		} catch (error) {
			// Handle any potential errors, log, and optionally rethrow or return a default value.
			console.error('Error occurred while fetching active employees:', error);
			return [];
		}
	}

	/**
	 * Find the employees working in the organization for a particular date range.
	 * An employee is considered to be 'working' if:
	 * 1. The startedWorkOn date is (not null and) less than the last day forMonth
	 * 2. The endWork date is either null or greater than the first day forMonth
	 * @param organizationId
	 * @param forRange
	 * @param withUser
	 * @returns
	 */
	async findWorkingEmployees(
		organizationId: ID,
		forRange: IDateRangePicker | any,
		withUser: boolean = false
	): Promise<IPagination<IEmployee>> {
		try {
			const query = this.typeOrmEmployeeRepository.createQueryBuilder(this.tableName);
			query.innerJoin(`${query.alias}.user`, 'user');
			query.innerJoin(`user.organizations`, 'organizations');
			query.setFindOptions({
				/**
				 * Load selected table properties/fields for self & relational select.
				 */
				select: {
					id: true,
					isActive: true,
					short_description: true,
					description: true,
					averageIncome: true,
					averageExpenses: true,
					averageBonus: true,
					startedWorkOn: true,
					isTrackingEnabled: true,
					billRateCurrency: true,
					billRateValue: true,
					minimumBillingRate: true,
					userId: true,
					isAway: true,
					isOnline: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						imageUrl: true,
						timeZone: true,
						timeFormat: true
					}
				},
				relations: {
					...(withUser ? { user: true } : {})
				}
			});
			// Set up the where clause using the provided filter function
			query.where((qb: SelectQueryBuilder<Employee>) => {
				this.getFilterQuery(qb, organizationId, forRange);
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			console.log('Error while getting working employees: %s', error);
		}
	}

	/**
	 * Find the counts of employees working in the organization for a particular date range.
	 * An employee is considered to be 'working' if:
	 * 1. The startedWorkOn date is (not null and) less than the last day forMonth
	 * 2. The endWork date is either null or greater than the first day forMonth
	 * @param organizationId
	 * @param forRange
	 * @returns
	 */
	async findWorkingEmployeesCount(
		organizationId: string,
		forRange: IDateRangePicker | any
	): Promise<{ total: number }> {
		try {
			const query = this.typeOrmEmployeeRepository.createQueryBuilder(this.tableName);
			query.innerJoin(`${query.alias}.user`, 'user');
			query.innerJoin(`user.organizations`, 'organizations');

			// Set up the where clause using the provided filter function
			query.where((qb: SelectQueryBuilder<Employee>) => {
				this.getFilterQuery(qb, organizationId, forRange);
			});

			const total = await query.getCount();
			return { total };
		} catch (error) {
			console.log('Error while getting working employee counts: %s', error);
		}
	}

	/**
	 * Adds a filter to the TypeORM SelectQueryBuilder for the Employee entity based on specified conditions.
	 *
	 * @param qb - The TypeORM SelectQueryBuilder for the Employee entity.
	 * @param organizationId - The organization ID to filter by.
	 * @param forRange - An object representing a date range (IDateRangePicker) or any other type.
	 */
	getFilterQuery(qb: SelectQueryBuilder<Employee>, organizationId: string, forRange: IDateRangePicker | any) {
		// Retrieve the current tenant ID from the RequestContext
		const tenantId = RequestContext.currentTenantId();

		// Apply filter conditions using TypeORM SelectQueryBuilder
		qb.andWhere(
			new Brackets((web: WhereExpressionBuilder) => {
				// Filter by tenant ID, organization ID, isActive, and isArchived
				web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
				web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
				web.andWhere(p(`"${qb.alias}"."isActive" = :isActive`), { isActive: true });
				web.andWhere(p(`"${qb.alias}"."isArchived" = :isArchived`), { isArchived: false });

				// Additional conditions for user isActive and isArchived
				web.andWhere(p(`"user"."isActive" = :isActive`), { isActive: true });
				web.andWhere(p(`"user"."isArchived" = :isArchived`), { isArchived: false });
			})
		);

		// Check for date range conditions
		if (isNotEmpty(forRange)) {
			if (forRange.startDate && forRange.endDate) {
				const { start: startDate, end: endDate } = getDateRangeFormat(
					moment.utc(forRange.startDate),
					moment.utc(forRange.endDate)
				);

				// Filter by startedWorkOn condition
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."startedWorkOn" <= :startedWorkOn`), {
							startedWorkOn: endDate
						});
					})
				);

				// Filter by endWork condition (NULL or >= startDate)
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.where(p(`"${qb.alias}"."endWork" IS NULL`));
						web.orWhere(p(`"${qb.alias}"."endWork" >= :endWork`), {
							endWork: startDate
						});
					})
				);
			}
		}

		// Check for permission CHANGE_SELECTED_EMPLOYEE
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Filter by current employee ID if the permission is not present
			const employeeId = RequestContext.currentEmployeeId();
			qb.andWhere(p(`"${qb.alias}"."id" = :employeeId`), { employeeId });
		}
	}

	/**
	 * Get all employees using pagination
	 *
	 * @param options Pagination options
	 * @returns Promise containing paginated employees and total count
	 */
	public async pagination(options: PaginationParams<any>): Promise<IPagination<IEmployee>> {
		try {
			// Retrieve the current tenant ID from the RequestContext
			const tenantId = RequestContext.currentTenantId();

			// Create a query builder for the Employee entity
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			// Tables joins with relations
			query.leftJoin(`${query.alias}.user`, 'user');
			query.leftJoin(`${query.alias}.tags`, 'tags');

			// Set pagination options and selected table properties/fields
			query.setFindOptions({
				skip: options && options.skip ? options.take * (options.skip - 1) : 0,
				take: options && options.take ? options.take : 10,
				select: {
					// Selected fields for the Employee entity
					id: true,
					short_description: true,
					description: true,
					averageIncome: true,
					averageExpenses: true,
					averageBonus: true,
					startedWorkOn: true,
					endWork: true,
					isTrackingEnabled: true,
					deletedAt: true,
					allowScreenshotCapture: true,
					allowManualTime: true,
					allowModifyTime: true,
					allowDeleteTime: true,
					isActive: true,
					isArchived: true,
					isAway: true,
					isOnline: true
				},
				...(options && options.relations ? { relations: options.relations } : {}),
				...(options && 'withDeleted' in options ? { withDeleted: options.withDeleted } : {}) // Include soft-deleted parent entities
			});

			// Build WHERE clause using QueryBuilder
			query.where((qb: SelectQueryBuilder<Employee>) => {
				const { where } = options;
				// Apply conditions related to the current tenant and organization ID
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });

						if (isNotEmpty(where?.organizationId)) {
							const organizationId = where.organizationId;
							web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
						}
					})
				);
				// Additional conditions based on the provided 'where' object
				if (isNotEmpty(where)) {
					// Apply conditions for specific fields in the Employee entity
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							const fields = ['isActive', 'isArchived', 'isTrackingEnabled', 'allowScreenshotCapture'];
							fields.forEach((key: string) => {
								if (key in where) {
									web.andWhere(p(`${qb.alias}.${key} = :${key}`), { [key]: where[key] });
								}
							});
						})
					);

					// Apply conditions related to tags
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.tags)) {
								web.andWhere(p('tags.id IN (:...tags)'), { tags: where.tags });
							}
						})
					);

					// Apply conditions related to the user property in the 'where' object
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							const { user } = where;
							if (isNotEmpty(user)) {
								if (isNotEmpty(user.name)) {
									const keywords: string[] = user.name.split(' ');
									keywords.forEach((keyword: string, index: number) => {
										web.orWhere(p(`LOWER("user"."firstName") like LOWER(:first_name_${index})`), {
											[`first_name_${index}`]: `%${keyword}%`
										});
										web.orWhere(p(`LOWER("user"."lastName") like LOWER(:last_name_${index})`), {
											[`last_name_${index}`]: `%${keyword}%`
										});
									});
								}
								if (isNotEmpty(user.email)) {
									const keywords: string[] = user.email.split(' ');
									keywords.forEach((keyword: string, index: number) => {
										web.orWhere(p(`LOWER("user"."email") like LOWER(:email_${index})`), {
											[`email_${index}`]: `%${keyword}%`
										});
									});
								}
							}
						})
					);
				}
			});

			// Execute the query and retrieve paginated items and total count
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Softly delete an employee by ID, with organization and tenant constraints.
	 *
	 * @param employeeId - ID of the employee to delete.
	 * @param params - Contains organizationId and possibly other per-tenant information.
	 * @returns - UpdateResult or DeleteResult depending on the ORM type.
	 */
	async softRemovedById(employeeId: ID, params: IBasePerTenantAndOrganizationEntityModel): Promise<Employee> {
		try {
			// Obtain the organization ID from the provided parameters
			const organizationId = params.organizationId;

			// Obtain tenant ID from the current request context
			const tenantId = RequestContext.currentTenantId() || params.tenantId;

			// Perform the soft delete operation
			return await super.softRemove(employeeId, {
				where: { organizationId, tenantId },
				relations: { user: { organizations: true }, teams: true }
			});
		} catch (error) {
			console.error('Error during soft delete for employee', error);
			throw new BadRequestException(error.message || 'Soft delete failed');
		}
	}

	/**
	 * Restores a soft-deleted employee by ID.
	 *
	 * This method restores an employee who was previously soft-deleted. It uses the organization ID
	 * and tenant ID to ensure that the correct employee is restored.
	 *
	 * @param employeeId The ID of the employee to restore.
	 * @param params Additional context parameters, including organization ID and tenant ID.
	 * @returns The restored Employee entity.
	 * @throws BadRequestException if the employee cannot be restored or if an error occurs.
	 */
	async softRecoverById(employeeId: ID, params: IBasePerTenantAndOrganizationEntityModel): Promise<Employee> {
		try {
			// Obtain the organization ID from the provided parameters
			const organizationId = params.organizationId;

			// Obtain the tenant ID from the current request context or the provided options
			const tenantId = RequestContext.currentTenantId() || params.tenantId;

			// Perform the soft recovery operation using the ID, organization ID, and tenant ID
			return await super.softRecover(employeeId, {
				where: { organizationId, tenantId },
				relations: { user: { organizations: true }, teams: true },
				withDeleted: true
			});
		} catch (error) {
			console.error('Error during soft recovery operation for employee:', error);
			// Throw a BadRequestException if any error occurs during soft recovery
			throw new BadRequestException(error.message || 'Failed to recover soft-deleted employee');
		}
	}
}
