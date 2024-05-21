import { BadRequestException, Injectable } from '@nestjs/common';
import { Brackets, FindManyOptions, FindOneOptions, In, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import {
	IBasePerTenantAndOrganizationEntityModel,
	IDateRangePicker,
	IEmployee,
	IOrganization,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum, getDateRangeFormat, parseTypeORMFindToMikroOrm } from './../core/utils';
import { Employee } from './employee.entity';
import { prepareSQLQuery as p } from './../database/database.helper';
import { MikroOrmEmployeeRepository, TypeOrmEmployeeRepository } from './repository';

@Injectable()
export class EmployeeService extends TenantAwareCrudService<Employee> {
	constructor(
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) {
		super(typeOrmEmployeeRepository, mikroOrmEmployeeRepository);
	}

	/**
	 * Finds employees based on an array of user IDs.
	 * @param userIds An array of user IDs.
	 * @returns A promise resolving to an array of employees.
	 */
	async findEmployeesByUserIds(userIds: string[]): Promise<Employee[]> {
		try {
			// Get the tenant ID from the current request context
			const tenantId = RequestContext.currentTenantId();

			// Construct the base where clause for querying employees by user IDs
			const whereClause = {
				userId: In(userIds), // Find employees with matching user IDs
				isActive: true, // Only active employees
				isArchived: false, // Exclude archived employees
				...(tenantId && { tenantId }) // Include tenant ID if available
			};

			// Execute the query based on the ORM type
			switch (this.ormType) {
				case MultiORMEnum.MikroORM: {
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<Employee>({
						where: whereClause
					} as FindManyOptions);
					const employees = await this.mikroOrmRepository.find(where, mikroOptions);
					return employees.map((entity: Employee) => this.serialize(entity)) as Employee[];
				}
				case MultiORMEnum.TypeORM: {
					return await this.typeOrmRepository.find({ where: whereClause });
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
	async findEmployeeIdByUserId(userId: string): Promise<string | null> {
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
	async findOneByUserId(userId: string, options?: FindOneOptions<Employee>): Promise<IEmployee | null> {
		try {
			const tenantId = RequestContext.currentTenantId();

			// Construct the where clause based on whether tenantId is available
			const whereClause = {
				userId,
				isActive: true,
				isArchived: false,
				...(tenantId && { tenantId }) // Include tenantId if available
			};
			const queryOptions = options ? { ...options } : {};

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { mikroOptions } = parseTypeORMFindToMikroOrm<Employee>(options as FindManyOptions);
					const item = await this.mikroOrmRepository.findOne(whereClause, mikroOptions);
					return this.serialize(item as Employee);
				case MultiORMEnum.TypeORM:
					return this.typeOrmRepository.findOne({
						where: whereClause,
						...queryOptions
					});
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
	public async findAllActive(): Promise<Employee[]> {
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
		organizationId: IOrganization['id'],
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
					isActive: true,
					isArchived: true
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
	 * @param options - Contains organizationId and possibly other per-tenant information.
	 * @returns - UpdateResult or DeleteResult depending on the ORM type.
	 */
	async softRemovedById(
		employeeId: IEmployee['id'],
		options: IBasePerTenantAndOrganizationEntityModel
	): Promise<Employee> {
		try {
			const { organizationId } = options;
			// Obtain tenant ID from the current request context
			const tenantId = RequestContext.currentTenantId() || options.tenantId;

			// Perform the soft delete operation
			return await super.softRemove(employeeId, {
				where: { organizationId, tenantId },
				relations: { user: true, teams: true }
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
	 * @param options Additional context parameters, including organization ID and tenant ID.
	 * @returns The restored Employee entity.
	 * @throws BadRequestException if the employee cannot be restored or if an error occurs.
	 */
	async softRecoverById(
		employeeId: IEmployee['id'],
		options: IBasePerTenantAndOrganizationEntityModel
	): Promise<Employee> {
		try {
			const { organizationId } = options;
			// Obtain the tenant ID from the current request context or the provided options
			const tenantId = RequestContext.currentTenantId() || options.tenantId;

			// Perform the soft recovery operation using the ID, organization ID, and tenant ID
			return await super.softRecover(employeeId, {
				where: { organizationId, tenantId },
				relations: { user: true, teams: true },
				withDeleted: true
			});
		} catch (error) {
			console.error('Error during soft recovery operation for employee:', error);
			// Throw a BadRequestException if any error occurs during soft recovery
			throw new BadRequestException(error.message || 'Failed to recover soft-deleted employee');
		}
	}
}
