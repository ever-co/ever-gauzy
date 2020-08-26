import { Entity, Column, ManyToOne, RelationId } from 'typeorm';
import {
	GoalTimeFrame as IGoalTimeFrame,
	TimeFrameStatusEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { Organization } from '../organization/organization.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('goal_time_frame')
export class GoalTimeFrame extends TenantBase implements IGoalTimeFrame {
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

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((goalTimeFrame: GoalTimeFrame) => goalTimeFrame.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
