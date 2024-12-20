import { RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IEmployee, IEmployeePhone } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmployeePhoneRepository } from './repository/mikro-orm-employee-phone.repository';

@MultiORMEntity('employee_phone', { mikroOrmRepository: () => MikroOrmEmployeePhoneRepository })
export class EmployeePhone extends TenantOrganizationBaseEntity implements IEmployeePhone {
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	type: string;

	@ApiProperty({ type: () => String, minLength: 4, maxLength: 12 })
	@ColumnIndex()
	@MultiORMColumn()
	phoneNumber: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.phoneNumbers, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeePhone) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: IEmployee['id'];
}
