import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, ILike } from 'typeorm';
import { Income } from './income.entity';
import { IPagination } from '../core';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
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
			if ('employeeName' in filters) {
				const { search } = filters.employeeName;
				filter.where = {
					...filter.where,
					employee: {
						user: {
							firstName: ILike(`%${search}%`)
						}
					}
				}
			}
			if ('clientName' in filters) {
				const { search } = filters.clientName;
				filter.where = {
					...filter.where,
					clientName: ILike(`%${search}%`)
				}
			}
			if ('notes' in filters) {
				const { search } = filters.notes;
				filter.where = {
					...filter.where,
					notes: ILike(`%${search}%`)
				}
			}
			delete filter['filters'];
		}

		if ('valueDate' in filter.where) {
			const { valueDate } = filter.where;
			const startOfMonth = moment(valueDate).startOf('month');
			const endOfMonth = moment(valueDate).endOf('month');

			filter.where.valueDate = Between(startOfMonth, endOfMonth);
		}

		return super.search(filter);
	}
}
