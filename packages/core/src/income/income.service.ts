import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination } from '@gauzy/contracts';
import { Repository, FindManyOptions, Between, Like, In } from 'typeorm';
import * as moment from 'moment';
import { Income } from './income.entity';
import { TenantAwareCrudService } from './../core/crud';

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

	public pagination(filter: any) {
		if ('filters' in filter) {
			const { filters } = filter;
			if ('notes' in filters) {
				const { search } = filters.notes;
				filter.where.notes = Like(`%${search}%`)
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
			if ('tags' in where) {
				const { tags } = where;
				filter.where.tags = {
					id: In(tags)
				}
			}
		}
		return super.paginate(filter);
	}
}
