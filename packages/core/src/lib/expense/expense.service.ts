import { BadRequestException, Injectable } from '@nestjs/common';
import { FindManyOptions, Between, Brackets, WhereExpressionBuilder, In, ILike } from 'typeorm';
import * as moment from 'moment';
import { chain } from 'underscore';
import {
	DecimalString,
	ID,
	IDateRangePicker,
	IExpense,
	IGetExpenseInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { Expense } from './expense.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { addDecimalStrings, normalizeDecimalString } from '../money/decimal';
import { getDateRangeFormat, getDaysBetweenDates, MultiORMEnum } from './../core/utils';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmExpenseRepository } from './repository/type-orm-expense.repository';
import { MikroOrmExpenseRepository } from './repository/mikro-orm-expense.repository';

/** One total of expense amounts: how many rows, and their exact sum, in one currency. */
export interface IExpenseTotal {
	currency: string;
	count: number;
	amount: DecimalString;
}

/** One day's total in one currency. `date` is the UTC calendar day of the expense's value date. */
export interface IExpenseDailyTotal extends IExpenseTotal {
	date: string;
}

/** One employee's or one project's total in one currency; `id` is null for the rows that name none. */
export interface IExpenseGroupTotal extends IExpenseTotal {
	id: ID | null;
}

/**
 * The expense report's figures as exact totals: the rows the report reads, summed per currency and per
 * each of the report's three groupings (day, employee, project).
 */
export interface IExpenseStatistics {
	count: number;
	totals: IExpenseTotal[];
	daily: IExpenseDailyTotal[];
	byEmployee: IExpenseGroupTotal[];
	byProject: IExpenseGroupTotal[];
}

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
			// No string round-trip: the former 'hh' (12-hour) format turned 00:00 into 12:00 and 23:59:59
			// into 11:59:59, so the range ran from noon on the 1st to noon on the last day.
			const startOfMonth = moment(filterDate).startOf('month').toDate();
			const endOfMonth = moment(filterDate).endOf('month').toDate();
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
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { organizationId, startDate, endDate, categoryId, projectIds = [] } = request;
				let { employeeIds = [] } = request;
				const tenantId = RequestContext.currentTenantId() || request.tenantId;
				const user = RequestContext.currentUser();
				const { start, end } = getDateRangeFormat(
					moment.utc(startDate || moment().startOf('week')),
					moment.utc(endDate || moment().endOf('week'))
				);
				const hasChangeSelectedEmployeePermission = RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				);
				const isOnlyMeSelected = request.onlyMe;
				if (
					(user.employeeId && isOnlyMeSelected) ||
					(!hasChangeSelectedEmployeePermission && user.employeeId)
				) {
					employeeIds = [user.employeeId];
				}

				const where: any = {
					tenantId,
					organizationId,
					valueDate: { $gte: start, $lte: end }
				};
				if (isNotEmpty(employeeIds)) where.employeeId = { $in: employeeIds };
				if (isNotEmpty(projectIds)) where.projectId = { $in: projectIds };
				if (categoryId) where.categoryId = categoryId;

				const populate = ['category', 'project'] as any[];
				if (hasChangeSelectedEmployeePermission) {
					populate.push('employee', 'employee.user');
				}

				const items = await this.mikroOrmRepository.find(where, {
					populate,
					orderBy: { valueDate: 'ASC' as any },
					...(request.limit > 0 ? { limit: request.limit, offset: (request.page || 0) * request.limit } : {})
				});
				return items.map((e) => this.serialize(e));
			}
			case MultiORMEnum.TypeORM:
			default: {
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
		}
	}

	/**
	 * The expense report's figures as exact totals.
	 *
	 * The rows are the ones `GET /expense/report` reads — the same reader, so the same tenant (the
	 * credential's), the same organization, the same window (the current week when none is stated), the same
	 * employee, project and category narrowing, and the same rule that a caller without
	 * `CHANGE_SELECTED_EMPLOYEE` reads their own expenses only. What differs is the answer: the report nests
	 * the rows by date, employee and project and the daily chart rounds each day to one decimal place, while
	 * this sums them exactly — as decimal strings, never as binary floats — per currency, because adding two
	 * currencies together produces a number that means nothing. The page the report reader accepts is not
	 * applied: a total over a page is not a total.
	 *
	 * @param request The report's own selectors.
	 * @returns The count, the totals per currency, and the totals per day, employee and project.
	 */
	async getStatistics(request: IGetExpenseInput): Promise<IExpenseStatistics> {
		// The reader puts the organization into its criterion as stated; an absent one would drop out of a
		// MikroORM criterion altogether and widen the totals to every organization of the tenant.
		if (!request?.organizationId) {
			throw new BadRequestException('EXPENSE_ORGANIZATION_REQUIRED: expense statistics are per organization.');
		}

		const rows = (await this.getExpense({ ...request, limit: undefined, page: undefined })) as IExpense[];

		const totals = new Map<string, IExpenseTotal>();
		const daily = new Map<string, IExpenseDailyTotal>();
		const byEmployee = new Map<string, IExpenseGroupTotal>();
		const byProject = new Map<string, IExpenseGroupTotal>();

		/** Adds one amount to the bucket a key names, creating it on first use. */
		const add = <B extends IExpenseTotal>(
			buckets: Map<string, B>,
			key: string,
			seed: () => B,
			amount: DecimalString
		): void => {
			const bucket = buckets.get(key) ?? seed();
			bucket.count += 1;
			bucket.amount = addDecimalStrings(bucket.amount, amount);
			buckets.set(key, bucket);
		};

		for (const row of rows ?? []) {
			const currency = row.currency;
			// The column is numeric; a driver may hand it over as a number or as text. Either is read as the
			// exact decimal it spells, which is what makes the sum below exact.
			const amount = normalizeDecimalString(row.amount ?? 0);
			const date = moment.utc(row.valueDate).format('YYYY-MM-DD');
			const employeeId = row.employeeId ?? null;
			const projectId = row.projectId ?? null;

			const zero = { currency, count: 0, amount: '0' };

			add(totals, currency, () => ({ ...zero }), amount);
			add(daily, `${date}|${currency}`, () => ({ ...zero, date }), amount);
			add(byEmployee, `${employeeId}|${currency}`, () => ({ ...zero, id: employeeId }), amount);
			add(byProject, `${projectId}|${currency}`, () => ({ ...zero, id: projectId }), amount);
		}

		const normalized = <B extends IExpenseTotal>(buckets: Map<string, B>): B[] =>
			Array.from(buckets.values()).map((bucket) => ({
				...bucket,
				amount: normalizeDecimalString(bucket.amount)
			}));

		return {
			count: rows?.length ?? 0,
			totals: normalized(totals),
			daily: normalized(daily).sort(
				(left, right) => left.date.localeCompare(right.date) || left.currency.localeCompare(right.currency)
			),
			byEmployee: normalized(byEmployee),
			byProject: normalized(byProject)
		};
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	async getDailyReportChartData(request: IGetExpenseInput) {
		const { startDate, endDate, organizationId, categoryId, projectIds = [] } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const user = RequestContext.currentUser();
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('week')),
			moment.utc(endDate || moment().endOf('week'))
		);

		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		const isOnlyMeSelected: boolean = request.onlyMe;

		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		let expenses: IExpense[];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const where: any = {
					tenantId,
					organizationId,
					valueDate: { $gte: start, $lte: end }
				};
				if (isNotEmpty(employeeIds)) where.employeeId = { $in: employeeIds };
				if (isNotEmpty(projectIds)) where.projectId = { $in: projectIds };
				if (categoryId) where.categoryId = categoryId;

				const items = await this.mikroOrmRepository.find(where, {
					orderBy: { valueDate: 'ASC' as any }
				});
				expenses = items.map((e) => this.serialize(e)) as IExpense[];
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.filterQuery(request);
				query.orderBy(p(`"${query.alias}"."valueDate"`), 'ASC');
				expenses = await query.getMany();
				break;
			}
		}

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
