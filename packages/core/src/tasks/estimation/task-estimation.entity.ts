import { ApiProperty } from '@nestjs/swagger';
import { Index, RelationId } from 'typeorm';
import { IsNumber } from 'class-validator';
import { IEmployee, ITask, ITaskEstimation } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity,
	Task,
} from './../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmTaskEstimationRepository } from './repository/mikro-orm-estimation.repository';
import { MultiORMManyToOne } from '../../core/decorators/entity/relations';

@MultiORMEntity('task_estimation', { mikroOrmRepository: () => MikroOrmTaskEstimationRepository })
export class TaskEstimation extends TenantOrganizationBaseEntity implements ITaskEstimation {
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn()
	estimate: number;

	@ApiProperty({ type: () => String })
	@RelationId((it: TaskEstimation) => it.employee)
	@Index()
	@MultiORMColumn({ relationId: true })
	employeeId: IEmployee['id'];

	@ApiProperty({ type: () => String })
	@RelationId((it: TaskEstimation) => it.task)
	@Index()
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
