import { IGoalGeneralSetting, GoalOwnershipEnum } from '@gauzy/contracts';
import { Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmGoalGeneralSettingRepository } from './repository/mikro-orm-goal-general-setting.repository';

@MultiORMEntity('goal_general_setting', { mikroOrmRepository: () => MikroOrmGoalGeneralSettingRepository })
export class GoalGeneralSetting extends TenantOrganizationBaseEntity implements IGoalGeneralSetting {

	@ApiProperty({ type: () => Number })
	@Column()
	maxObjectives: number;

	@ApiProperty({ type: () => Number })
	@Column()
	maxKeyResults: number;

	@ApiProperty({ type: () => Boolean })
	@Column()
	employeeCanCreateObjective: boolean;

	@ApiProperty({ type: () => String, enum: GoalOwnershipEnum })
	@IsEnum(GoalOwnershipEnum)
	@Column()
	canOwnObjectives: string;

	@ApiProperty({ type: () => String, enum: GoalOwnershipEnum })
	@IsEnum(GoalOwnershipEnum)
	@Column()
	canOwnKeyResult: string;

	@ApiProperty({ type: () => Boolean })
	@Column()
	krTypeKPI: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column()
	krTypeTask: boolean;
}
