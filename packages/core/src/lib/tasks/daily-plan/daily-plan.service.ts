import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder, UpdateResult } from 'typeorm';
import {
	ID,
	IDailyPlan,
	IDailyPlanCreateInput,
	IDailyPlansTasksUpdateInput,
	IDailyPlanTasksUpdateInput,
	IDailyPlanUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { BaseQueryDTO, TenantAwareCrudService } from '../../core/crud';
import { RequestContext } from '../../core/context/request-context';
import { EmployeeService } from '../../employee/employee.service';
import { TaskService } from '../task.service';
import { DailyPlan } from './daily-plan.entity';
import { MikroOrmDailyPlanRepository } from './repository/mikro-orm-daily-plan.repository';
import { TypeOrmDailyPlanRepository } from './repository/type-orm-daily-plan.repository';

@Injectable()
export class DailyPlanService extends TenantAwareCrudService<DailyPlan> {
	constructor(
		protected readonly typeOrmDailyPlanRepository: TypeOrmDailyPlanRepository,
		protected readonly mikroOrmDailyPlanRepository: MikroOrmDailyPlanRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _taskService: TaskService
	) {
		super(typeOrmDailyPlanRepository, mikroOrmDailyPlanRepository);
	}

	/**
	 * Create or update a DailyPlan. If the given day already has a DailyPlan,
	 * update it with the provided task. Otherwise, create a new DailyPlan.
	 *
	 * @param partialEntity - Data to create or update the DailyPlan
	 * @returns The created or updated DailyPlan
	 */
	async createDailyPlan(partialEntity: IDailyPlanCreateInput): Promise<IDailyPlan> {
		try {
			const { employeeId, organizationId, organizationTeamId, taskId } = partialEntity;
			const tenantId = RequestContext.currentTenantId() ?? partialEntity.tenantId;

			const dailyPlanDate = new Date(partialEntity.date).toISOString().split('T')[0];

			// Validate employee existence
			const employee = await this._employeeService.findOneByIdString(employeeId);
			if (!employee) {
				throw new NotFoundException('Employee not found');
			}

			// Check for existing DailyPlan
			const query = this.typeOrmDailyPlanRepository.createQueryBuilder('dailyPlan');
			query.setFindOptions({ relations: { tasks: true } });
			query.where('"dailyPlan"."tenantId" = :tenantId', { tenantId });
			query.andWhere('"dailyPlan"."organizationId" = :organizationId', { organizationId });
			query.andWhere('"dailyPlan"."organizationTeamId" = :organizationTeamId', { organizationTeamId });
			query.andWhere(p(`DATE("dailyPlan"."date") = :dailyPlanDate`), { dailyPlanDate: `${dailyPlanDate}` });
			query.andWhere('"dailyPlan"."employeeId" = :employeeId', { employeeId });
			let dailyPlan = await query.getOne();

			// Create or update DailyPlan
			if (!dailyPlan) {
				dailyPlan = new DailyPlan({
					...partialEntity,
					employeeId: employee.id,
					employee: { id: employee.id },
					tasks: []
				});
			}

			// If a taskId is provided, add the task to the DailyPlan
			if (taskId) {
				const task = await this._taskService.findOneByIdString(taskId);
				if (!task) {
					throw new BadRequestException('Task not found');
				}
				dailyPlan.tasks.push(task);
			}

			await this.save(dailyPlan); // Save changes

			return dailyPlan; // Return the created/updated DailyPlan
		} catch (error) {
			throw new BadRequestException(error); // Clearer error messaging
		}
	}

	/**
	 * Retrieves daily plans with pagination and additional query options.
	 *
	 * @param options - Pagination and additional query options for filtering and retrieving daily plans.
	 * @returns A promise that resolves to an object containing the list of daily plans and the total count.
	 * @throws BadRequestException - If there's an error during the query.
	 */
	async getAllPlans(options: BaseQueryDTO<DailyPlan>, employeeId?: ID): Promise<IPagination<IDailyPlan>> {
		try {
			const { where } = options;
			const tenantId = RequestContext.currentTenantId() ?? where?.tenantId;

			// Create the initial query
			const query = this.typeOrmDailyPlanRepository.createQueryBuilder(this.tableName);

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
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), {
				organizationId: where?.organizationId
			});

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
	async getDailyPlansByEmployee(options: BaseQueryDTO, employeeId?: ID): Promise<IPagination<IDailyPlan>> {
		// Fetch all daily plans for specific employee
		return await this.getAllPlans(options, employeeId);
	}

	/**
	 * Retrieves daily plans for all employees of a specific team with pagination and additional query options.
	 *
	 * @param teamId - The ID of the team for whom to retrieve daily plans.
	 * @param options - Pagination and additional query options for filtering and retrieving daily plans.
	 * @returns A promise that resolves to an object containing the list of daily plans and the total count.
	 * @throws BadRequestException - If there's an error during the query.
	 */
	async getTeamDailyPlans(options: BaseQueryDTO<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		try {
			// Apply optional find options if provided
			const { where, relations = [] } = options || {};
			const { organizationId, organizationTeamId } = where;
			const tenantId = RequestContext.currentTenantId() ?? where?.tenantId;

			// Create the initial query
			const query = this.typeOrmDailyPlanRepository.createQueryBuilder(this.tableName);

			// Join related entities
			query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
			query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');

			query.setFindOptions({
				where: isNotEmpty(where) && where,
				relations: isNotEmpty(relations) && relations
			});

			// Filter conditions
			query.where(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

			if (organizationTeamId) {
				query.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), {
					organizationTeamId
				});
			}

			// Retrieve results and total count
			const [items, total] = await query.getManyAndCount();

			// Return the pagination result
			return { items, total };
		} catch (error) {
			console.log('Error while fetching daily plans for team');
			throw new HttpException(`Failed to fetch daily plans for team: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Retrieves daily plans for the current employee based on given pagination options.
	 *
	 * @param options Pagination options for fetching daily plans.
	 * @returns A promise resolving to daily plans for the current employee.
	 */
	async getMyPlans(options: BaseQueryDTO<DailyPlan>): Promise<IPagination<IDailyPlan>> {
		const currentEmployeeId = RequestContext.currentEmployeeId();

		// Fetch daily plans for the current employee
		return await this.getAllPlans(options, currentEmployeeId);
	}

	/**
	 * Add a task to a specified daily plan.
	 *
	 * @param planId - The unique identifier of the daily plan to which the task will be added.
	 * @param input - An object containing details about the task to add, including task ID, employee ID, and organization ID.
	 * @returns The updated daily plan with the newly added task.
	 */
	async addTaskToPlan(planId: ID, input: IDailyPlanTasksUpdateInput): Promise<IDailyPlan> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { employeeId, taskId, organizationId } = input;

			// Fetch the daily plan with the given conditions
			const dailyPlan = await this.findOneByIdString(planId, {
				where: {
					employeeId,
					tenantId,
					organizationId
				},
				relations: { tasks: true } // Ensure we get the existing tasks
			});

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}

			// Fetch the task to be added
			const taskToAdd = await this._taskService.findOneByIdString(taskId, {
				where: { organizationId, tenantId }
			});

			// Add the new task to the daily plan's tasks array
			dailyPlan.tasks.push(taskToAdd);

			// Save the updated daily plan
			return await this.save(dailyPlan);
		} catch (error) {
			throw new BadRequestException(error.message);
		}
	}

	/**
	 * Delete task from a given daily plan
	 *
	 * @param  planId The unique identifier of the daily plan to which the task will be removed.
	 * @param input - An object containing details about the task to remove, including task ID, employee ID, and organization ID.
	 * @returns The updated daily plan without the deleted task.
	 */
	async removeTaskFromPlan(planId: ID, input: IDailyPlanTasksUpdateInput): Promise<IDailyPlan> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { employeeId, taskId, organizationId } = input;

			const dailyPlan = await this.findOneByIdString(planId, {
				where: {
					employeeId,
					tenantId,
					organizationId
				},
				relations: { tasks: true } // Include the existing tasks for the daily plan
			});

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}

			// Get task to be removed
			const taskToRemove = await this._taskService.findOneByIdString(taskId, {
				where: { organizationId, tenantId }
			});

			if (!taskToRemove) {
				throw new BadRequestException('The task to remove not found');
			}

			// Remove the task form the daily plan's tasks array
			const { tasks } = dailyPlan;
			dailyPlan.tasks = tasks.filter((task) => task.id !== taskId);

			// Save and return the updated daily plan
			return await this.save(dailyPlan);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Delete task from a many daily plans
	 *
	 * @param  taskId The unique identifier of the task to removed from daily plans.
	 * @param input - An object containing details about the plans to update, including employee ID, and organization ID.
	 * @returns The updated daily plans without the deleted task.
	 */

	async removeTaskFromManyPlans(taskId: ID, input: IDailyPlansTasksUpdateInput): Promise<IDailyPlan[]> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { employeeId, plansIds, organizationId, organizationTeamId } = input;
			const currentDate = new Date().toISOString().split('T')[0];

			// Initial query
			const query = this.typeOrmDailyPlanRepository.createQueryBuilder(this.tableName);

			// Joins
			query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
			query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
			query.leftJoinAndSelect('employee.user', 'user');

			// Conditions
			query.where(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
			query.andWhere(p(`"${query.alias}"."organizationTeamId" = :organizationTeamId`), { organizationTeamId });
			query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });

			// Find condition must include only today and future plans. We cannot delete tasks from past plans
			query.andWhere(p(`DATE("${query.alias}"."date") >= :currentDate`), { currentDate });

			// If the user send specific plan ids, then delete the task from those plans.
			// Otherwise, delete the task from all future and today plans to those it belongs
			if (plansIds.length > 0) {
				query.andWhere(p(`${query.alias}.id IN (:...plansIds)`), { plansIds });
			} else {
				query.andWhere((qb: SelectQueryBuilder<any>) => {
					const subQuery = qb.subQuery();
					subQuery
						.select(p('"daily_plan_task"."dailyPlanId"'))
						.from(p('daily_plan_task'), p('daily_plan_task'));
					subQuery.andWhere(p('"daily_plan_task"."taskId" = :taskId'), { taskId });

					return p(`${query.alias}.id IN `) + subQuery.distinct(true).getQuery();
				});
			}

			const dailyPlansToUpdate = await query.getMany();

			if (dailyPlansToUpdate.length < 1) {
				throw new BadRequestException('Daily plans not found');
			}

			// Get task to be removed
			const taskToRemove = await this._taskService.findOneByIdString(taskId, {
				where: { organizationId, tenantId }
			});

			if (!taskToRemove) {
				throw new BadRequestException('The task to remove not found');
			}

			const updatedPlans = dailyPlansToUpdate.map((plan) => {
				const { tasks } = plan;
				plan.tasks = tasks.filter((task) => task.id !== taskId);
				return plan;
			});

			// save and return the updatedDailyPlan
			return await this.typeOrmDailyPlanRepository.save(updatedPlans);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * UPDATE Daily plan
	 *
	 * @param id - The unique identifier of the daily plan to be updated.
	 * @param partialEntity - An object with data to update, including organization ID and employee ID.
	 * @returns The updated daily plan including related tasks.
	 * @memberof DailyPlanService
	 */
	async updateDailyPlan(id: ID, partialEntity: IDailyPlanUpdateInput): Promise<IDailyPlan | UpdateResult> {
		try {
			const { employeeId, organizationId } = partialEntity;

			// Get the tenant ID from the current Request
			const currentTenantId = RequestContext.currentTenantId();

			// Fetch the daily plan to update
			const dailyPlan = await this.findOneByIdString(id, {
				where: {
					employeeId,
					tenantId: currentTenantId,
					organizationId
				},
				relations: { tasks: true }
			});

			if (!dailyPlan) {
				throw new BadRequestException('Daily plan not found');
			}

			// Return the updated daily plan
			const updatedDailyPlan = await this.typeOrmDailyPlanRepository.preload({
				id,
				...partialEntity,
				tasks: dailyPlan.tasks
			});
			return await this.save(updatedDailyPlan);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Retrieves daily plans for a specific task including employee
	 * @param options pagination and additional query options
	 * @param taskId - The ID of the task for whom to retrieve daily plans.
	 * @returns A promise that resolves to an object containing the list of plans and total count
	 */
	async getDailyPlansByTask(options: BaseQueryDTO, taskId: ID): Promise<IPagination<IDailyPlan>> {
		try {
			const { where } = options;
			const { organizationId } = where;
			const tenantId = RequestContext.currentTenantId();

			// Initial query
			const query = this.typeOrmDailyPlanRepository.createQueryBuilder(this.tableName);

			// Joins
			query.leftJoinAndSelect(`${query.alias}.employee`, 'employee');
			query.leftJoinAndSelect(`${query.alias}.tasks`, 'tasks');
			query.leftJoinAndSelect('employee.user', 'user');

			// Conditions
			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

			query.andWhere((qb: SelectQueryBuilder<any>) => {
				const subQuery = qb.subQuery();
				subQuery.select(p('"daily_plan_task"."dailyPlanId"')).from(p('daily_plan_task'), p('daily_plan_task'));
				subQuery.andWhere(p('"daily_plan_task"."taskId" = :taskId'), { taskId });

				return p(`${query.alias}.id IN `) + subQuery.distinct(true).getQuery();
			});

			// Retrieves results and total count
			const [items, total] = await query.getManyAndCount();

			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
