import { IGoalGeneralSetting, GoalOwnershipEnum } from '@gauzy/contracts';
import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('goal_general_setting')
export class GoalGeneralSetting
	extends TenantOrganizationBaseEntity
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
