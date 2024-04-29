import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DeepPartial, UpdateResult, WhereExpressionBuilder } from 'typeorm';
import { IDailyPlan, IEmployee, ITask } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { isPostgres } from '@gauzy/config';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { PaginationParams, TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context';
import { EmployeeService } from '../../employee/employee.service';
import { TaskService } from '../task.service';
import { MikroOrmDailyPlanRepository, TypeOrmDailyPlanRepository } from './repository';
import { DailyPlan } from './daily-plan.entity';

@Injectable()
export class DailyPlanService extends TenantAwareCrudService<DailyPlan> {
	constructor(
		@InjectRepository(DailyPlan) readonly typeOrmDailyPlanRepository: TypeOrmDailyPlanRepository,
		readonly mikroOrmDailyPlanRepository: MikroOrmDailyPlanRepository,
		private readonly employeeService: EmployeeService,
		private readonly taskService: TaskService
	) {
		super(typeOrmDailyPlanRepository, mikroOrmDailyPlanRepository);
	}

	/**
	 * Create daily plan
	 * @param entity
	 * @param params
	 * @param options
	 */

	async createDailyPlan(
		partialEntity: DeepPartial<IDailyPlan>,
		options: PaginationParams<DailyPlan>,
		taskId?: ITask['id']
	): Promise<IDailyPlan> {
		try {
			const { employeeId } = partialEntity;
			const currentTenantId = RequestContext.currentTenantId();

			const employee = await this.employeeService.findOneByWhereOptions({
				id: employeeId,
				tenantId: currentTenantId
			});

			if (!employee) {
				throw new BadRequestException('Cannot found employee');
			}

			let wantCreatePlan: DailyPlan;

			const likeOperator = isPostgres() ? '::text LIKE' : ' LIKE';

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			query.setFindOptions({
				...(isNotEmpty(options) &&
					isNotEmpty(options.where) && {
						where: options.where
					}),
				...(isNotEmpty(options) &&
					isNotEmpty(options.relations) && {
						relations: options.relations
					})
			});

			query.where(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."date" ${likeOperator} :incomingDate`), {
						incomingDate: `${new Date(partialEntity.date as Date).toISOString().split('T')[0]}%`
					});
				})
			);

			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const currentEmployeeId = RequestContext.currentEmployeeId();
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId: currentEmployeeId });
				})
			);

			const result = await query.getOne();

			if (result) {
				wantCreatePlan = result;
			} else {
				wantCreatePlan = new DailyPlan({ ...partialEntity, employeeId: employee.id, tasks: [] });
			}

			if (taskId) {
				const wantCreatePlannedTask = await this.taskService.findOneByIdString(taskId);
				if (!wantCreatePlannedTask) {
					throw new BadRequestException('Cannot found the plan requested to plan');
				}
				wantCreatePlan.tasks = [...wantCreatePlan.tasks, wantCreatePlannedTask];
				await this.save(wantCreatePlan);
			}
			return wantCreatePlan;
		} catch (error) {
			console.log(error);
			throw new BadRequestException(error.message);
		}
	}

	/**
	 * GET daily plans for a given employee
	 *
	 * @param employeeId
	 * @param options
	 * @returns
	 */

	async getDailyPlansByEmployee(employeeId: IEmployee['id'], options: PaginationParams<DailyPlan>) {
		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoin(`${query.alias}.employee`, 'employee');
			query.leftJoin(`${query.alias}.tasks`, 'tasks');

			query.setFindOptions({
				...(isNotEmpty(options) &&
					isNotEmpty(options.where) && {
						where: options.where
					}),
				...(isNotEmpty(options) &&
					isNotEmpty(options.relations) && {
						relations: options.relations
					})
			});
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const tenantId = RequestContext.currentTenantId();
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
				})
			);
			return await query.getMany();
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves daily plans for the current employee based on given pagination options.
	 *
	 * @param options Pagination options for fetching daily plans.
	 * @returns A promise resolving to daily plans for the current employee.
	 */
	async getMyPlans(options: PaginationParams<DailyPlan>): Promise<any> {
		try {
			// Get the current employee ID from the request context
			const currentEmployeeId = RequestContext.currentEmployeeId();
			// Fetch daily plans for the current employee
			return this.getDailyPlansByEmployee(currentEmployeeId, options);
		} catch (error) {
			console.error('Error fetching daily plans for me:', error); // Log the error for debugging
		}
	}

	/**
	 * Delete task from a given daily plan
	 *
	 * @param {IDailyPlan['id']} planId
	 * @param {string} taskId
	 * @param {PaginationParams<DailyPlan>} options
	 * @memberof DailyPlanService
	 * @returns
	 */
	async removeTaskFromPlan(planId: IDailyPlan['id'], taskId: ITask['id'], options: PaginationParams<DailyPlan>) {
		try {
			const currentEmployeeId = RequestContext.currentEmployeeId();
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			query.setFindOptions({
				...(isNotEmpty(options) && isNotEmpty(options.where) && { where: options.where }),
				...(isNotEmpty(options) && isNotEmpty(options.relations) && { relations: options.relations })
			});

			query.where(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId: currentEmployeeId });
				})
			);

			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."id" = :planId`), {
						planId
					});
				})
			);
			const dailyPlan = await query.getOne();

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}

			const { tasks } = dailyPlan;
			dailyPlan.tasks = tasks.filter((task) => task.id !== taskId);

			return await this.save(dailyPlan);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * @description UPDATE Daily plan
	 *
	 * @param {IDailyPlan['id']} id
	 * @param {DeepPartial<IDailyPlan>} partialEntity
	 * @returns
	 * @memberof DailyPlanService
	 */
	async updateDailyPlan(
		id: IDailyPlan['id'],
		partialEntity: DeepPartial<IDailyPlan>
	): Promise<IDailyPlan | UpdateResult> {
		try {
			const currentEmployeeId = RequestContext.currentEmployeeId();
			const currentTenantId = RequestContext.currentTenantId();

			const dailyPlan = await this.findOneByWhereOptions({
				id,
				employeeId: currentEmployeeId,
				tenantId: currentTenantId
			});

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}
			return await this.update(id, partialEntity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * DELETE daily plan
	 *
	 * @param {IDailyPlan['id']} planId
	 * @returns
	 * @memberof DailyPlanService
	 */
	async deletePlan(planId: IDailyPlan['id']) {
		try {
			const currentEmployeeId = RequestContext.currentEmployeeId();

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			query.where(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId: currentEmployeeId });
				})
			);

			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."id" = :planId`), { planId });
				})
			);

			const dailyPlan = await query.getOne();

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}

			return await this.softDelete(planId);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
