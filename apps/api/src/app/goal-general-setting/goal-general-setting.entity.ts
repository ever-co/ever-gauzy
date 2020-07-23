import {
	GoalGeneralSetting as IGoalGeneralSetting,
	GoalOwnershipEnum
} from '@gauzy/models';
import { Entity, Column, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TenantBase } from '../core/entities/tenant-base';
import { IsEnum } from 'class-validator';
import { Organization } from '../organization/organization.entity';

@Entity('goal_general_setting')
export class GoalGeneralSetting extends TenantBase
	implements IGoalGeneralSetting {
	@ApiProperty({ type: Number })
	@Column()
	maxObjectives: number;

	@ApiProperty({ type: Number })
	@Column()
	maxKeyResults: number;

	@ApiProperty({ type: Boolean })
	@Column()
	employeeCanCreateObjective: boolean;

	@ApiProperty({ type: String, enum: GoalOwnershipEnum })
	@IsEnum(GoalOwnershipEnum)
	@Column()
	canOwnObjectives: string;

	@ApiProperty({ type: String, enum: GoalOwnershipEnum })
	@IsEnum(GoalOwnershipEnum)
	@Column()
	canOwnKeyResult: string;

	@ApiProperty({ type: Boolean })
	@Column()
	krTypeKPI: boolean;

	@ApiProperty({ type: Boolean })
	@Column()
	krTypeTask: boolean;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
