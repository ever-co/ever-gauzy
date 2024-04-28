import { InjectConnection } from 'nest-knexjs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DeepPartial, WhereExpressionBuilder } from 'typeorm';
import { Knex as KnexConnection } from 'knex';
import { MikroOrmDailyPlanRepository, TypeOrmDailyPlanRepository } from './repository';
import { DailyPlan } from './daily-plan.entity';
import { IDailyPlan, IEmployee, ITask } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from '../../core/crud';
import { isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../core/context';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { EmployeeService } from '../../employee/employee.service';
import { TaskService } from '../task.service';
import { GetTaskByIdDTO } from '../dto';
import { isPostgres } from '@gauzy/config';

@Injectable()
export class DailyPlanService extends TenantAwareCrudService<DailyPlan> {
	constructor(
		@InjectRepository(DailyPlan)
		readonly typeOrmDailyPlanRepository: TypeOrmDailyPlanRepository,

		readonly mikroOrmDailyPlanRepository: MikroOrmDailyPlanRepository,

		private readonly employeeService: EmployeeService,
		private readonly taskService: TaskService,

		@InjectConnection()
		readonly knexConnection: KnexConnection
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
		params: GetTaskByIdDTO,
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
				const { relations, ...rest } = params;
				const wantCreatePlannedTask = await this.taskService.findById(taskId, rest);
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
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
						tenantId
					});
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
	 * GET my plans
	 *
	 * @param options
	 * @returns
	 */

	async getMyPlans(options: PaginationParams<DailyPlan>) {
		const currentEmployeeId = RequestContext.currentEmployeeId();
		return await this.getDailyPlansByEmployee(currentEmployeeId, options);
	}
}
