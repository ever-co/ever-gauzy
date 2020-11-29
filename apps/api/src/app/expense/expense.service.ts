import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
import { Expense } from './expense.entity';
import { IPagination } from '../core';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { startOfMonth, endOfMonth } from 'date-fns';
import { RequestContext } from '../core/context';
import { IGetExpenseInput, PermissionsEnum } from '@gauzy/models';
import * as moment from 'moment';

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
			const dateObject = new Date(filterDate);
			return filter
				? await this.findAll({
						where: {
							valueDate: Between(
								startOfMonth(dateObject),
								endOfMonth(dateObject)
							),
							...(filter.where as Object)
						},
						relations: filter.relations
				  })
				: await this.findAll({
						where: {
							valueDate: Between(
								startOfMonth(dateObject),
								endOfMonth(dateObject)
							)
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

	async getExpanse(request: IGetExpenseInput) {
		const query = this.filterQuery(request);
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

		return await query.getMany();
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
				const startDate = moment.utc(request.startDate).toDate();
				const endDate = moment.utc(request.endDate).toDate();
				qb.andWhere(
					`"${query.alias}"."valueDate" Between :startDate AND :endDate`,
					{
						startDate,
						endDate
					}
				);
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
}
