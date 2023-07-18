import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, RelationId, ManyToOne } from 'typeorm';
import { IsNumber } from 'class-validator';
import { IEmployee, ITask, ITaskEstimation } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity,
	Task,
} from './../../core/entities/internal';

@Entity('task_estimation')
export class TaskEstimation
	extends TenantOrganizationBaseEntity
	implements ITaskEstimation
{
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column()
	estimate: number;

	@ApiProperty({ type: () => String })
	@RelationId((it: TaskEstimation) => it.employee)
	@Index()
	@Column()
	employeeId: IEmployee['id'];

	@ApiProperty({ type: () => String })
	@RelationId((it: TaskEstimation) => it.task)
	@Index()
	@Column()
	taskId: ITask['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.estimations, {
		onDelete: 'CASCADE',
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => Task })
	@ManyToOne(() => Task, (task) => task.estimations, {
		onDelete: 'CASCADE',
	})
	task?: ITask;
}
