import { Injectable } from '@nestjs/common';
import { FindManyOptions, Between, Brackets, WhereExpressionBuilder, In, ILike } from 'typeorm';
import * as moment from 'moment';
import { chain } from 'underscore';
import { IDateRangePicker, IExpense, IGetExpenseInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Expense } from './expense.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { getDateRangeFormat, getDaysBetweenDates } from './../core/utils';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmExpenseRepository } from './repository/type-orm-expense.repository';
import { MikroOrmExpenseRepository } from './repository/mikro-orm-expense.repository';

@Injectable()
export class ExpenseService extends TenantAwareCrudService<Expense> {
	constructor(
		typeOrmExpenseRepository: TypeOrmExpenseRepository,
		mikroOrmExpenseRepository: MikroOrmExpenseRepository
	) {
		super(typeOrmExpenseRepository, mikroOrmExpenseRepository);
	}

	/**
	 *
	 * @param filter
	 * @param filterDate
	 * @returns
	 */
	public async findAllExpenses(
		filter?: FindManyOptions<Expense>,
		filterDate?: string
	): Promise<IPagination<Expense>> {
		if (filterDate) {
			const startOfMonth = moment(moment(filterDate).startOf('month').format('YYYY-MM-DD hh:mm:ss')).toDate();
			const endOfMonth = moment(moment(filterDate).endOf('month').format('YYYY-MM-DD hh:mm:ss')).toDate();
			return filter
				? await this.findAll({
						where: {
							valueDate: Between<Date>(startOfMonth, endOfMonth),
							...(filter.where as Object)
						},
						relations: filter.relations
				  })
				: await this.findAll({
						where: {
							valueDate: Between(startOfMonth, endOfMonth)
						}
				  });
		}
		return await this.findAll(filter || {});
	}

	/**
	 *
	 * @param data
	 * @returns
	 */
	public countStatistic(data: number[]) {
		return data.filter(Number).reduce((a, b) => a + b, 0) !== 0
			? data.filter(Number).reduce((a, b) => a + b, 0) / data.filter(Number).length
			: 0;
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	async getExpense(request: IGetExpenseInput) {
		const query = this.filterQuery(request);
		query.orderBy(p(`"${query.alias}"."valueDate"`), 'ASC');

		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			query.leftJoinAndSelect(`${query.alias}.employee`, 'activityEmployee');
			query.leftJoinAndSelect(
				`activityEmployee.user`,
				'activityUser',
				p('"employee"."userId" = activityUser.id')
			);
		}

		query.leftJoinAndSelect(`${query.alias}.category`, 'category');
		query.leftJoinAndSelect(`${query.alias}.project`, 'project');
		return await query.getMany();
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	async getDailyReportChartData(request: IGetExpenseInput) {
		const query = this.filterQuery(request);
		query.orderBy(p(`"${query.alias}"."valueDate"`), 'ASC');

		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const expenses = await query.getMany();
		const byDate = chain(expenses)
			.groupBy((expense) => moment(expense.valueDate).format('YYYY-MM-DD'))
			.mapObject((expenses: IExpense[], date) => {
				const sum = expenses.reduce((iteratee: any, expense: any) => {
					return iteratee + parseFloat(expense.amount);
				}, 0);
				return {
					date,
					value: {
						expense: sum.toFixed(1)
					}
				};
			})
			.value();

		const dates = days.map((date) => {
			if (byDate[date]) {
				return byDate[date];
			} else {
				return {
					date: date,
					value: {
						expense: 0
					}
				};
			}
		});

		return dates;
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	private filterQuery(request: IGetExpenseInput) {
		const { organizationId, startDate, endDate, categoryId, projectIds = [] } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const user = RequestContext.currentUser();

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		// Set employeeIds based on permissions and request
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		const query = this.typeOrmRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}
		query.leftJoin(`${query.alias}.employee`, 'employee');
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where({
					valueDate: Between(start, end)
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), {
						employeeIds
					});
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), {
						projectIds
					});
				}
				if (categoryId) {
					qb.andWhere(p(`"${query.alias}"."categoryId" = :categoryId`), {
						categoryId
					});
				}
			})
		);

		return query;
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
	public pagination(filter: FindManyOptions) {
		if ('where' in filter) {
			const { where } = filter;
			if ('notes' in where) {
				filter['where']['notes'] = ILike(`%${where.notes}%`);
			}
			if ('purpose' in where) {
				filter['where']['purpose'] = ILike(`%${where.purpose}%`);
			}
			if ('valueDate' in where) {
				const { valueDate } = where;
				const { startDate, endDate } = valueDate as IDateRangePicker;
				if (startDate && endDate) {
					filter['where']['valueDate'] = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter['where']['valueDate'] = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('tags' in where) {
				filter['where']['tags'] = {
					id: In(where.tags)
				};
			}
		}
		return super.paginate(filter);
	}
}
