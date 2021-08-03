import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, ILike } from 'typeorm';
import { Expense } from './expense.entity';
import { getDateRangeFormat, IPagination } from '../core';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { IGetExpenseInput, PermissionsEnum } from '@gauzy/contracts';
import * as moment from 'moment';
import { chain } from 'underscore';
import { getConfig } from '@gauzy/config';
const config = getConfig();

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
			const startOfMonth = moment(filterDate)
				.startOf('month')
				.format('YYYY-MM-DD hh:mm:ss');
			const endOfMonth = moment(filterDate)
				.endOf('month')
				.format('YYYY-MM-DD hh:mm:ss');
			return filter
				? await this.findAll({
						where: {
							valueDate: Between(startOfMonth, endOfMonth),
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

		let dayList = [];
		const range = {};
		let i = 0;
		const start = moment(request.startDate);
		while (start.isSameOrBefore(request.endDate) && i < 31) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		dayList = Object.keys(range);
		const expenses = await query.getMany();

		const byDate = chain(expenses)
			.groupBy((expense) =>
				moment(expense.valueDate).format('YYYY-MM-DD')
			)
			.mapObject((expenses: Expense[], date) => {
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

		const dates = dayList.map((date) => {
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
		let employeeIds: string[];
		const query = this.expenseRepository.createQueryBuilder();
		if (request && request.limit > 0) {
			query.take(request.limit);
			query.skip((request.page || 0) * request.limit);
		}
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

		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.where((qb) => {
			if (request.startDate && request.endDate) {
				let startDate: any = moment.utc(request.startDate);
				let endDate: any = moment.utc(request.endDate);

				if (config.dbConnectionOptions.type === 'sqlite') {
					startDate = startDate.format('YYYY-MM-DD HH:mm:ss');
					endDate = endDate.format('YYYY-MM-DD HH:mm:ss');
				} else {
					startDate = startDate.toDate();
					endDate = endDate.toDate();
				}

				qb.where({
					valueDate: Between(startDate, endDate)
				});
			}
			if (employeeIds) {
				qb.andWhere(
					`"${query.alias}"."employeeId" IN (:...employeeId)`,
					{
						employeeId: employeeIds
					}
				);
			}
			if (request.projectIds) {
				qb.andWhere(`"${query.alias}"."projectId" IN (:...projectId)`, {
					projectId: request.projectIds
				});
			}
			if (request.organizationId) {
				qb.andWhere(
					`"${query.alias}"."organizationId" = :organizationId`,
					{
						organizationId: request.organizationId
					}
				);
			}
			qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId: RequestContext.currentTenantId()
			});
		});

		return query;
	}

	public pagination(filter: any) {
		if ('filters' in filter) {
			const { filters } = filter;
			if ('notes' in filters) {
				const { search } = filters.notes;
				filter.where.notes = ILike(`%${search}%`);
			}
			if ('purpose' in filters) {
				const { search } = filters.purpose;
				filter.where.purpose = ILike(`%${search}%`);
			}
			delete filter['filters'];
		}
		if ('where' in filter) {
			const { where } = filter;
			if ('valueDate' in where) {
				const { valueDate } = where;
				const { start, end } = getDateRangeFormat(
					new Date(moment(valueDate).startOf('month').format()),
					new Date(moment(valueDate).endOf('month').format()),
					true
				);
				filter.where.valueDate = Between(start, end); 
			}
		}
		return super.paginate(filter);
	}
}
