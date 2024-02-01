import { Column } from 'typeorm';
import { IGoalTimeFrame, TimeFrameStatusEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmGoalTimeFrameRepository } from './repository/mikro-orm-goal-time-frame.repository';

@MultiORMEntity('goal_time_frame', { mikroOrmRepository: () => MikroOrmGoalTimeFrameRepository })
export class GoalTimeFrame extends TenantOrganizationBaseEntity implements IGoalTimeFrame {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String, enum: TimeFrameStatusEnum })
	@IsEnum(TimeFrameStatusEnum)
	@Column()
	status: string;

	@ApiProperty({ type: () => Date })
	@Column()
	startDate: Date;

	@ApiProperty({ type: () => Date })
	@Column()
	endDate: Date;
}
