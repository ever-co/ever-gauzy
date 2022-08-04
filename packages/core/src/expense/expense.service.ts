import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, Like, Brackets, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { chain } from 'underscore';
import { IExpense, IGetExpenseInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { Expense } from './expense.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { getDateRangeFormat, getDaysBetweenDates } from './../core/utils';

@Injectable()
export class ExpenseService extends TenantAwareCrudService<Expense> {
	constructor(
		@InjectRepository(Expense)
		private readonly expenseRepository: Repository<Expense>
	) {
		super(expenseRepository);
	}

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

	public countStatistic(data: number[]) {
		return data.filter(Number).reduce((a, b) => a + b, 0) !== 0
			? data.filter(Number).reduce((a, b) => a + b, 0) /
					data.filter(Number).length
			: 0;
	}

	async getExpense(request: IGetExpenseInput) {
		const query = this.filterQuery(request);
		query.orderBy(`"${query.alias}"."valueDate"`, 'ASC');

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			query.leftJoinAndSelect(
				`${query.alias}.employee`,
				'activityEmployee'
			);
			query.leftJoinAndSelect(
				`activityEmployee.user`,
				'activityUser',
				'"employee"."userId" = activityUser.id'
			);
		}

		query.leftJoinAndSelect(`${query.alias}.category`, 'category');
		query.leftJoinAndSelect(`${query.alias}.project`, 'project');
		return await query.getMany();
	}

	async getDailyReportChartData(request: IGetExpenseInput) {
		const query = this.filterQuery(request);
		query.orderBy(`"${query.alias}"."valueDate"`, 'ASC');

		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const expenses = await query.getMany();
		const byDate = chain(expenses)
			.groupBy((expense) =>
				moment(expense.valueDate).format('YYYY-MM-DD')
			)
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

	private filterQuery(request: IGetExpenseInput) {
		const { organizationId, startDate, endDate } = request;
		let { employeeIds = [], projectIds = [] } = request;

		const { start, end } = (startDate && endDate) ?
								getDateRangeFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateRangeFormat(
									moment().startOf('week').utc(),
									moment().endOf('week').utc()
								);

		const tenantId = RequestContext.currentTenantId();
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (request.employeeIds) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}

		const query = this.expenseRepository.createQueryBuilder();
		if (request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}
		query.leftJoin(`${query.alias}.employee`, 'employee');
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
			})
		)
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.where(						{
					valueDate: Between(start, end)
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}
			})
		);
		return query;
	}

	public pagination(filter: any) {
		if ('filters' in filter) {
			const { filters } = filter;
			if ('notes' in filters) {
				const { search } = filters.notes;
				filter.where.notes = Like(`%${search}%`);
			}
			if ('purpose' in filters) {
				const { search } = filters.purpose;
				filter.where.purpose = Like(`%${search}%`);
			}
			delete filter['filters'];
		}
		if ('where' in filter) {
			const { where } = filter;
			if ('valueDate' in where) {
				const { valueDate } = where;
				const { startDate, endDate } = valueDate;

				if (startDate && endDate) {
					filter.where.valueDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter.where.valueDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
		}
		return super.paginate(filter);
	}
}
