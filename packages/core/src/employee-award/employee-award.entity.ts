import { Index, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IEmployee, IEmployeeAward } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEmployeeAwardRepository } from './repository/mikro-orm-employee-award.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('employee_award', { mikroOrmRepository: () => MikroOrmEmployeeAwardRepository })
export class EmployeeAward extends TenantOrganizationBaseEntity
	implements IEmployeeAward {

	@ApiProperty({ type: () => String })
	@Index()
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
	@Index()
	@MultiORMColumn()
	employeeId?: string;
}
