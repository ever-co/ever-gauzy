import { IDateRangePicker, IEmployee, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNotEmpty } from '@gauzy/common';
import * as moment from 'moment';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { RequestContext } from '../core/context';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService extends TenantAwareCrudService<Employee> {
	constructor(
		@InjectRepository(Employee)
		protected readonly employeeRepository: Repository<Employee>
	) {
		super(employeeRepository);
	}

	public async findAllActive(): Promise<Employee[]> {
		const user = RequestContext.currentUser();

		if (user && user.tenantId) {
			return await this.repository.find({
				where: { isActive: true, tenantId: user.tenantId },
				relations: ['user']
			});
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
		organizationId: string,
		forRange: IDateRangePicker | any,
		withUser: boolean
	): Promise<IPagination<IEmployee>> {
		const query = this.repository.createQueryBuilder(this.alias);
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
				user: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					imageUrl: true
				}
			},
			relations: {
				...(withUser ? { user: true } : {})
			}
		});
		query.where((qb: SelectQueryBuilder<Employee>) => {
			const tenantId = RequestContext.currentTenantId();
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
					web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
					web.andWhere(`"${qb.alias}"."isActive" = :isActive`, { isActive: true });
				})
			);
			if (isNotEmpty(forRange)) {
				if (forRange.startDate && forRange.endDate) {
					const { startDate, endDate } = forRange;
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.andWhere(`"${qb.alias}"."startedWorkOn" <= :startedWorkOn`, {
								startedWorkOn: moment.utc(endDate).format('YYYY-MM-DD hh:mm:ss')
							});
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							web.where(`"${qb.alias}"."endWork" IS NULL`);
							web.orWhere( `"${qb.alias}"."endWork" >= :endWork`, {
								endWork: moment.utc(startDate).format('YYYY-MM-DD hh:mm:ss')
							});
						})
					);
				}
			}
			if (!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				const employeeId = RequestContext.currentEmployeeId();
				qb.andWhere(`"${qb.alias}"."id" = :employeeId`, { employeeId });
			}
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Find the counts of employees working in the organization for a particular date range.
	 * An employee is considered to be 'working' if:
	 * 1. The startedWorkOn date is (not null and) less than the last day forMonth
	 * 2. The endWork date is either null or greater than the first day forMonth
	 * @param organizationId
	 * @param forRange
	 * @param withUser
	 * @returns
	 */
	async findWorkingEmployeesCount(
		organizationId: string,
		forRange: IDateRangePicker | any,
		withUser: boolean
	): Promise<{ total: number }> {
		const { total } = await this.findWorkingEmployees(
			organizationId,
			forRange,
			withUser
		);
		return {
			total
		};
	}

	/**
	 * Get all employees using pagination
	 *
	 * @param options
	 * @returns
	 */
	public async pagination(
		options: PaginationParams<any>
	): Promise<IPagination<IEmployee>> {
		try {
			const query = this.repository.createQueryBuilder(this.alias);
			/**
			 * Tables joins with relations
			 */
			query.innerJoin(`${query.alias}.user`, 'user');
			query.leftJoin(`${query.alias}.tags`, 'tags');
			query.innerJoin(`user.organizations`, 'organizations');
			/**
			 * Set skip/take options for pagination
			 */
			query.setFindOptions({
				skip: options && options.skip ? (options.take * (options.skip - 1)) : 0,
				take: options && options.take ? (options.take) : 10
			});
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
					user: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						imageUrl: true
					}
				},
				/**
				 * Load tables relations.
				 */
				...(
					(options && options.relations) ? {
						relations: options.relations
					} : {}
				)
			});
			query.where((qb: SelectQueryBuilder<Employee>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
							tenantId: RequestContext.currentTenantId()
						});
						if (isNotEmpty(options.where)) {
							const { where } = options;
							if (isNotEmpty(where.organizationId)) {
								const { organizationId } = where;
								web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
									organizationId
								});
							}
						}
					})
				);
				if (isNotEmpty(options.where)) {
					const { where } = options;
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (
								isNotEmpty(where.isActive) &&
								isNotEmpty(Boolean(JSON.parse(where.isActive)))
							) {
								web.andWhere(`"${qb.alias}"."isActive" = :isActive`, {
									isActive: true
								});
							}
						})
					);
					if ('isTrackingEnabled' in where)  {
						qb.andWhere(
							new Brackets((web: WhereExpressionBuilder) => {
								const { isTrackingEnabled } = where;
								web.andWhere(`"${qb.alias}"."isTrackingEnabled" = :isTrackingEnabled`, {
									isTrackingEnabled: Boolean(JSON.parse(isTrackingEnabled))
								});
							})
						);
					}
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.tags)) {
								const { tags } = where;
								web.andWhere(`"tags"."id" IN (:...tags)`, { tags });
							}
						})
					);
					qb.andWhere(
						new Brackets((web: WhereExpressionBuilder) => {
							if (isNotEmpty(where.user)) {
								if (isNotEmpty(where.user.name)) {
									const keywords: string[] = where.user.name.split(' ');
									keywords.forEach((keyword: string, index: number) => {
										web.orWhere(`LOWER("user"."firstName") like LOWER(:keyword_${index})`, {
											[`keyword_${index}`]:`%${keyword}%`
										});
										web.orWhere(`LOWER("user"."lastName") like LOWER(:${index}_keyword)`, {
											[`${index}_keyword`]:`%${keyword}%`
										});
									});
								}
								if (isNotEmpty(where.user.email)) {
									const { email } = where.user;
									web.orWhere(`LOWER("user"."email") like LOWER(:email)`, {
										email:`%${email}%`
									});
								}
							}
						})
					);
				}
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Removed employee
	 *
	 * @param employeeId
	 */
	async remove(employeeId: IEmployee['id']) {
		try {
			const entity = await this.findOneByIdString(employeeId);
			return await this.repository.remove(entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
