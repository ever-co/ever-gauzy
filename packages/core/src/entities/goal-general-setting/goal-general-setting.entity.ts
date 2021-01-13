import { IGoalGeneralSetting, GoalOwnershipEnum } from '@gauzy/common';
import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('goal_general_setting')
export class GoalGeneralSetting
	extends TenantOrganizationBase
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
}
