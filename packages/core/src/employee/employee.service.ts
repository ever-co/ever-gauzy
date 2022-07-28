import { IDateRangePicker, IEmployee, IEmployeeCreateInput, IPagination } from '@gauzy/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNotEmpty } from '@gauzy/common';
import * as moment from 'moment';
import { Brackets, FindManyOptions, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService extends TenantAwareCrudService<Employee> {
	constructor(
		@InjectRepository(Employee)
		protected readonly employeeRepository: Repository<Employee>
	) {
		super(employeeRepository);
	}

	/**
	 * Create Bulk Employee User
	 *
	 * @param input
	 * @returns
	 */
	async createBulk(input: IEmployeeCreateInput[]): Promise<Employee[]> {
		const employees: IEmployee[] = [];
		for await (let employee of input) {
			employee.user.tenant = {
				id: employee.organization.tenantId
			};
			employees.push(await this.create(employee));
		}
		return employees;
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
	 * Find the employees working in the organization for a particular month.
	 * An employee is considered to be 'working' if:
	 * 1. The startedWorkOn date is (not null and) less than the last day forMonth
	 * 2. The endWork date is either null or greater than the first day forMonth
	 * @param organizationId  The organization id of the employees to find
	 * @param tenantId  The tenant id of the employees to find
	 * @param forMonth  Only the month & year is considered
	 */
	async findWorkingEmployees(
		organizationId: string,
		forRange: IDateRangePicker | any,
		withUser: boolean
	): Promise<IPagination<IEmployee>> {
		const [items, total] = await this.employeeRepository.findAndCount({
			where: (query: SelectQueryBuilder<Employee>) => {
				const { startDate, endDate } = forRange;
				const tenantId = RequestContext.currentTenantId();
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
						qb.andWhere(`"${query.alias}"."isActive" = :isActive`, { isActive: true });
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"${query.alias}"."startedWorkOn" <= :startedWorkOn`, {
							startedWorkOn: moment.utc(endDate).format('YYYY-MM-DD hh:mm:ss')
						});
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.where(`"${query.alias}"."endWork" IS NULL`);
						qb.orWhere( `"${query.alias}"."endWork" >= :endWork`, {
							endWork: moment.utc(startDate).format('YYYY-MM-DD hh:mm:ss')
						});
					})
				);
			},
			relations: [
				...(withUser ? ['user'] : [])
			]
		} as FindManyOptions<Employee>);
		return {
			total,
			items
		};
	}

	/**
	 * Find the counts of employees working in the organization for a particular month.
	 * An employee is considered to be 'working' if:
	 * 1. The startedWorkOn date is (not null and) less than the last day forMonth
	 * 2. The endWork date is either null or greater than the first day forMonth
	 * @param organizationId  The organization id of the employees to find
	 * @param tenantId  The tenant id of the employees to find
	 * @param forMonth  Only the month & year is considered
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

	async findWithoutTenant(id: string, relations?: any) {
		return await this.repository.findOne({
			where: {
				id
			},
			relations
		});
	}

	public async pagination(filter: any) {
		try {
			const [items, total] = await this.repository.findAndCount({
				skip: filter && filter.skip ? (filter.take * (filter.skip - 1)) : 0,
				take: filter && filter.take ? (filter.take) : 10,
				join: {
					alias: 'employee',
					leftJoin: {
						user: 'employee.user',
						tags: 'employee.tags'
					}
				},
				relations: [
					...(filter && filter.relations) ? filter.relations : []
				],
				where: (query: SelectQueryBuilder<Employee>) => {
					const tenantId = RequestContext.currentTenantId();
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							if (filter.where) {
								const { where } = filter;
								const { tenantId, organizationId } = where;

								qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
								qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							}
						})
					);
					if (filter.where) {
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								const { where } = filter;
								if (isNotEmpty(Boolean(JSON.parse(where.isActive)))) {
									qb.andWhere(`"${query.alias}"."isActive" = :isActive`, {
										isActive: true
									});
								}
							})
						);
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								const { where } = filter;
								if (isNotEmpty(where.tags)) {
									const { tags } = where;
									qb.andWhere(`"tags"."id" IN (:...tags)`, { tags });
								}
							})
						);
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => {
								const { where } = filter;
								if (isNotEmpty(where.user)) {
									if (isNotEmpty(where.user.name)) {
										const keywords: string[] = where.user.name.split(' ');
										keywords.forEach((keyword: string, index: number) => {
											qb.orWhere(`LOWER("user"."firstName") like LOWER(:keyword_${index})`, {
												[`keyword_${index}`]:`%${keyword}%`
											});
											qb.orWhere(`LOWER("user"."lastName") like LOWER(:${index}_keyword)`, {
												[`${index}_keyword`]:`%${keyword}%`
											});
										});
									}
									if (isNotEmpty(where.user.email)) {
										const { email } = where.user;
										qb.orWhere(`LOWER("user"."email") like LOWER(:email)`, {
											email:`%${email}%`
										});
									}
								}
							})
						);
					}
				}
			} as FindManyOptions<Employee>);
			return { items, total };
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error);
		}
	}
}
