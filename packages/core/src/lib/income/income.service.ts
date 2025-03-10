import { Injectable } from '@nestjs/common';
import { FindManyOptions, Between, In, Raw } from 'typeorm';
import * as moment from 'moment';
import { IPagination } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { LIKE_OPERATOR } from '../core/util';
import { Income } from './income.entity';
import { MikroOrmIncomeRepository } from './repository/mikro-orm-income.repository';
import { TypeOrmIncomeRepository } from './repository/type-orm-income.repository';

@Injectable()
export class IncomeService extends TenantAwareCrudService<Income> {
	constructor(
		readonly typeOrmIncomeRepository: TypeOrmIncomeRepository,
		readonly mikroOrmIncomeRepository: MikroOrmIncomeRepository
	) {
		super(typeOrmIncomeRepository, mikroOrmIncomeRepository);
	}

	/**
	 * Retrieves a paginated list of incomes, optionally filtering by a specific month.
	 *
	 * @param filter - Optional filtering options for incomes.
	 * @param filterDate - Optional date string used to filter incomes for its month.
	 * @returns A promise that resolves to a paginated list of incomes.
	 */
	public async findAllIncomes(filter?: FindManyOptions<Income>, filterDate?: string): Promise<IPagination<Income>> {
		if (filterDate) {
			// Calculate the start and end of the month using Moment.js.
			const startOfMonth = moment(filterDate).startOf('month').toDate();
			const endOfMonth = moment(filterDate).endOf('month').toDate();

			return filter
				? await this.findAll({
						where: {
							valueDate: Between<Date>(startOfMonth, endOfMonth),
							...(filter.where as Object)
						},
						relations: filter?.relations || []
				  })
				: await this.findAll({
						where: {
							valueDate: Between<Date>(startOfMonth, endOfMonth)
						}
				  });
		}
		return await this.findAll(filter || {});
	}

	/**
	 * Computes the average of the non-falsy numbers in the given array.
	 *
	 * @param data - An array of numbers.
	 * @returns The average of the non-falsy numbers, or 0 if there are none.
	 */
	public countStatistic(data: number[]) {
		return data.filter(Number).reduce((a, b) => a + b, 0) !== 0
			? data.filter(Number).reduce((a, b) => a + b, 0) / data.filter(Number).length
			: 0;
	}

	/**
	 * Paginates organization contacts with custom filtering.
	 *
	 * @param filter - The filter options (including where conditions) for the query.
	 * @returns A promise that resolves to a paginated result of organization contacts.
	 */
	public pagination(filter: PaginationParams) {
		if (filter?.where) {
			const { where } = filter;

			// Apply like filter for notes field
			if (where.notes) {
				const operator = Raw((alias) => `${alias} ${LIKE_OPERATOR} :notes`, { notes: `%${where.notes}%` });
				filter['where']['notes'] = operator;
			}

			// Apply date range filter for valueDate field
			if (where.valueDate) {
				const { startDate, endDate } = where.valueDate;

				const start = startDate ? moment.utc(startDate) : moment().startOf('month').utc();
				const end = endDate ? moment.utc(endDate) : moment().endOf('month').utc();

				filter['where']['valueDate'] = Between<string>(
					start.format('YYYY-MM-DD HH:mm:ss'),
					end.format('YYYY-MM-DD HH:mm:ss')
				);
			}

			// Apply filter for tags field
			if (where.tags) {
				const { tags } = where;

				filter['where']['tags'] = {
					id: In(tags)
				};
			}
		}

		return super.paginate(filter ?? {});
	}
}
