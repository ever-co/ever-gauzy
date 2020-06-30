import { Entity, Column, ManyToOne } from 'typeorm';
import { Base } from '../core/entities/base';
import {
	GoalTimeFrame as IGoalTimeFrame,
	TimeFrameStatusEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Organization } from '../organization/organization.entity';

@Entity('goal_time_frame')
export class GoalTimeFrame extends Base implements IGoalTimeFrame {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String, enum: TimeFrameStatusEnum })
	@IsEnum(TimeFrameStatusEnum)
	@Column()
	status: string;

	@ApiProperty({ type: Date })
	@Column()
	startDate: Date;

	@ApiProperty({ type: Date })
	@Column()
	endDate: Date;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
