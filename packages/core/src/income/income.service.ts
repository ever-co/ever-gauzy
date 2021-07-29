import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, ILike, In } from 'typeorm';
import { Income } from './income.entity';
import { getDateRangeFormat, IPagination } from '../core';
import { TenantAwareCrudService } from './../core/crud';
import * as moment from 'moment';

@Injectable()
export class IncomeService extends TenantAwareCrudService<Income> {
	constructor(
		@InjectRepository(Income)
		private readonly incomeRepository: Repository<Income>
	) {
		super(incomeRepository);
	}

	public async findAllIncomes(
		filter?: FindManyOptions<Income>,
		filterDate?: string
	): Promise<IPagination<Income>> {
		if (filterDate) {
			const startOfMonth = moment(filterDate).startOf('month').format('YYYY-MM-DD hh:mm:ss');
			const endOfMonth = moment(filterDate).endOf('month').format('YYYY-MM-DD hh:mm:ss');
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

	public search(filter: any) {
		if ('filters' in filter) {
			const { filters } = filter;
			if ('notes' in filters) {
				const { search } = filters.notes;
				filter.where.notes = ILike(`%${search}%`)
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
			if ('tags' in where) {
				const { tags } = where; 
				filter.where.tags = {
					id: In(tags)
				}
			}
		}
		return super.search(filter);
	}
}
