import { Entity, Column } from 'typeorm';
import {
	DeepPartial,
	IGoalTimeFrame,
	TimeFrameStatusEnum
} from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../internal';

@Entity('goal_time_frame')
export class GoalTimeFrame
	extends TenantOrganizationBaseEntity
	implements IGoalTimeFrame {
	constructor(input?: DeepPartial<GoalTimeFrame>) {
		super(input);
	}

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
}
