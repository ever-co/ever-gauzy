import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, IEmployee, IEmployeeRecentVisit, JsonData } from '@gauzy/contracts';
import { BasePerEntityType, Employee } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmEmployeeRecentVisitRepository } from './repository/mikro-orm-employee-recent-visit.repository';

@MultiORMEntity('employee_recent_visit', { mikroOrmRepository: () => MikroOrmEmployeeRecentVisitRepository })
export class EmployeeRecentVisit extends BasePerEntityType implements IEmployeeRecentVisit {
	[EntityRepositoryType]?: MikroOrmEmployeeRecentVisitRepository;

	/**
	 * The date and time when the employee visited the some entity.
	 */
	@ApiProperty({ type: () => Date })
	@Type(() => Date)
	@IsNotEmpty()
	@IsDate()
	@MultiORMColumn()
	visitedAt: Date;

	/**
	 * The data associated with the some entity.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
		nullable: true
	})
	data?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The employee who recently visited the some entity.
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The ID of the employee who recently visited the some entity.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EmployeeRecentVisit) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;
}
