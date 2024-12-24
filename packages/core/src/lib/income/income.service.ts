import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Between, In, Raw } from 'typeorm';
import * as moment from 'moment';
import { IDateRangePicker, IPagination } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { Income } from './income.entity';
import { TenantAwareCrudService } from './../core/crud';
import { MikroOrmIncomeRepository } from './repository/mikro-orm-income.repository';
import { TypeOrmIncomeRepository } from './repository/type-orm-income.repository';

@Injectable()
export class IncomeService extends TenantAwareCrudService<Income> {
	constructor(
		@InjectRepository(Income)
		typeOrmIncomeRepository: TypeOrmIncomeRepository,

		mikroOrmIncomeRepository: MikroOrmIncomeRepository
	) {
		super(typeOrmIncomeRepository, mikroOrmIncomeRepository);
	}

	public async findAllIncomes(filter?: FindManyOptions<Income>, filterDate?: string): Promise<IPagination<Income>> {
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
			? data.filter(Number).reduce((a, b) => a + b, 0) / data.filter(Number).length
			: 0;
	}

	public pagination(filter: FindManyOptions) {
		if ('where' in filter) {
			const { where } = filter;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';
			if ('notes' in where) {
				filter['where']['notes'] = Raw((alias) => `${alias} ${likeOperator} '%${where.notes}%'`);
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
				const { tags } = where;
				filter['where']['tags'] = {
					id: In(tags)
				};
			}
		}
		return super.paginate(filter);
	}
}
