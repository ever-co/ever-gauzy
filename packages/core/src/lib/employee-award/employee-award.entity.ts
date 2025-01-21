import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IEmployee, IEmployeeAward } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmployeeAwardRepository } from './repository/mikro-orm-employee-award.repository';

@MultiORMEntity('employee_award', { mikroOrmRepository: () => MikroOrmEmployeeAwardRepository })
export class EmployeeAward extends TenantOrganizationBaseEntity implements IEmployeeAward {
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	year: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (it) => it.awards, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeAward) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: string;
}
