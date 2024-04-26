import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/knex';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { DailyPlan, Task, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { MikroOrmDailyPlanTaskRepository } from './repository/mikro-orm-daily-plan-task';
import { IDailyPlan, IDailyPlanTask, ITask } from '@gauzy/contracts';

@MultiORMEntity('daily_plan_task', { mikroOrmRepository: () => MikroOrmDailyPlanTaskRepository })
export class DailyPlanTask extends TenantOrganizationBaseEntity implements IDailyPlanTask {
	[EntityRepositoryType]?: MikroOrmDailyPlanTaskRepository;

	@ApiProperty({ type: () => DailyPlan })
	@MultiORMManyToOne(() => DailyPlan, {
		nullable: true,
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	})
	@JoinColumn()
	dailyPlan: IDailyPlan;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: DailyPlanTask) => it.dailyPlan)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	dailyPlanId: IDailyPlan['id'];

	@ApiProperty({ type: () => Task })
	@MultiORMManyToOne(() => Task, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	task: ITask;

	@ApiPropertyOptional({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: DailyPlanTask) => it.task)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskId: ITask['id'];
}
