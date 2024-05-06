import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DeepPartial, SelectQueryBuilder, UpdateResult, WhereExpressionBuilder } from 'typeorm';
import { IDailyPlan, IEmployee, IPagination, ITask } from '@gauzy/contracts';
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
	async createDailyPlan(partialEntity: DeepPartial<IDailyPlan>, taskId?: ITask['id']): Promise<IDailyPlan> {
		try {
			const { employeeId, organizationId } = partialEntity;
			const tenantId = RequestContext.currentTenantId();

			const employee = await this.employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException('Cannot found employee');
			}

			let wantCreatePlan: DailyPlan;
			const likeOperator = isPostgres() ? '::text LIKE' : ' LIKE';

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			query.setFindOptions({
				relations: ['tasks']
			});

			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."date" ${likeOperator} :incomingDate`), {
						incomingDate: `${new Date(partialEntity.date as Date).toISOString().split('T')[0]}%`
					});
				})
			);
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					const employeeId = RequestContext.currentEmployeeId();
					qb.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
				})
			);

			const result = await query.getOne();

			if (result) {
				wantCreatePlan = result;
			} else {
				wantCreatePlan = new DailyPlan({
					...partialEntity,
					employeeId: employee.id,
					tasks: []
				});
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
	 * Retrieves daily plans with pagination and additional query options.
	 *
	 * @param options - Pagination and additional query options for filtering and retrieving daily plans.
	 * @returns A promise that resolves to an object containing the list of daily plans and the total count.
	 * @throws BadRequestException - If there's an error during the query.
	 */

	async getAllPlans(
		options: PaginationParams<DailyPlan>,
		employeeId?: IEmployee['id']
	): Promise<IPagination<IDailyPlan>> {
		try {
			const { where } = options;
			const { organizationId } = where;
			const tenantId = RequestContext.currentTenantId();

			// Create the initial query
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			// Join related entities
			query.leftJoin(`${query.alias}.employee`, 'employee');
			query.leftJoin(`${query.alias}.tasks`, 'tasks');

			// Apply optional find options if provided
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

			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

			if (employeeId) {
				query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
			}

			// Retrieve results and total count
			const [items, total] = await query.getManyAndCount();

			// Return the pagination result
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves daily plans for a specific employee with pagination and additional query options.
	 *
	 * @param employeeId - The ID of the employee for whom to retrieve daily plans.
	 * @param options - Pagination and additional query options for filtering and retrieving daily plans.
	 * @returns A promise that resolves to an object containing the list of daily plans and the total count.
	 * @throws BadRequestException - If there's an error during the query.
	 */

	async getDailyPlansByEmployee(
		options: PaginationParams,
		employeeId?: IEmployee['id']
	): Promise<IPagination<IDailyPlan>> {
		try {
			// Fetch all daily plans for specific employee
			return await this.getAllPlans(options, employeeId);
		} catch (error) {
			console.log('Error fetching all daily plans');
		}
	}

	/**
	 * Retrieves daily plans for the current employee based on given pagination options.
	 *
	 * @param options Pagination options for fetching daily plans.
	 * @returns A promise resolving to daily plans for the current employee.
	 */
	async getMyPlans(options: PaginationParams<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		try {
			// Get the current employee ID from the request context
			const currentEmployeeId = RequestContext.currentEmployeeId();

			// Fetch daily plans for the current employee
			return await this.getAllPlans(options, currentEmployeeId);
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
	async removeTaskFromPlan(
		planId: IDailyPlan['id'],
		taskId: ITask['id'],
		options: PaginationParams<DailyPlan>
	): Promise<IDailyPlan> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const currentEmployeeId = RequestContext.currentEmployeeId();

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			query.setFindOptions({
				...(isNotEmpty(options) && isNotEmpty(options.where) && { where: options.where }),
				...(isNotEmpty(options) && isNotEmpty(options.relations) && { relations: options.relations })
			});

			query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId: currentEmployeeId });
			query.andWhere(p(`"${query.alias}".tenantId = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."id" = :planId`), { planId });

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
			const tenantId = RequestContext.currentTenantId();
			const currentEmployeeId = RequestContext.currentEmployeeId();

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId: currentEmployeeId });
			query.andWhere(p(`"${query.alias}".tenantId = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}".id = :planId`), { planId });
			const dailyPlan = await query.getOne();

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}

			return await super.delete(planId);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves daily plans for a specific task including employee
	 * @param options pagination and additionnal query options
	 * @param taskId - The ID of the task for whom to retrieve daily plans.
	 * @returns A promise that resolves to an object containing the list of plans and total count
	 */
	async getPlansByTaskId(options: PaginationParams, taskId: ITask['id']): Promise<IPagination<IDailyPlan>> {
		try {
			const { where } = options;
			const { organizationId } = where;
			const tenantId = RequestContext.currentTenantId();

			// Initial query
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

			// Joins
			query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
			query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
			query.leftJoinAndSelect('employee.user', 'user');

			// Conditions
			query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
			query.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });

			query.andWhere((qb: SelectQueryBuilder<any>) => {
				const subQuery = qb.subQuery();
				subQuery.select(p('"daily_plan_task"."dailyPlanId"')).from(p('daily_plan_task'), p('daily_plan_task'));
				subQuery.andWhere(p('"daily_plan_task"."taskId" = :taskId'), { taskId });

				return p(`${query.alias}.id IN `) + subQuery.distinct(true).getQuery();
			});

			// Retrive results and total count
			const [items, total] = await query.getManyAndCount();

			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
