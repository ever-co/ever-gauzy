import { ApiProperty } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { IsNumber } from 'class-validator';
import { IEmployee, ITask, ITaskEstimation } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity,
	Task,
} from './../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../../core/decorators/entity';
import { MikroOrmTaskEstimationRepository } from './repository/mikro-orm-estimation.repository';

@MultiORMEntity('task_estimation', { mikroOrmRepository: () => MikroOrmTaskEstimationRepository })
export class TaskEstimation extends TenantOrganizationBaseEntity implements ITaskEstimation {
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn()
	estimate: number;

	@ApiProperty({ type: () => String })
	@RelationId((it: TaskEstimation) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: IEmployee['id'];

	@ApiProperty({ type: () => String })
	@RelationId((it: TaskEstimation) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	taskId: ITask['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.estimations, {
		onDelete: 'CASCADE',
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => Task })
	@MultiORMManyToOne(() => Task, (task) => task.estimations, {
		onDelete: 'CASCADE',
	})
	task?: ITask;
}
