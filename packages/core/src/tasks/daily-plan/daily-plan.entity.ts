import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/knex';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { DailyPlanStatusEnum, IDailyPlan, IEmployee } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { Employee, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { MikroOrmDailyPlanRepository } from './repository';

@MultiORMEntity('daily_plan', { mikroOrmRepository: () => MikroOrmDailyPlanRepository })
export class DailyPlan extends TenantOrganizationBaseEntity implements IDailyPlan {
	[EntityRepositoryType]?: MikroOrmDailyPlanRepository;

	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	@MultiORMColumn()
	date: Date;

	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	@MultiORMColumn()
	workTimePlanned: Date;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	status: DailyPlanStatusEnum;

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DailyPlan) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: IEmployee['id'];
}
