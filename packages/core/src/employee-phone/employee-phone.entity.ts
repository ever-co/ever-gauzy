import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IEmployee, IEmployeePhone } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity,
} from '../core/entities/internal';

@Entity('employee_phone')
export class EmployeePhone
	extends TenantOrganizationBaseEntity
	implements IEmployeePhone
{
	@ApiProperty({ type: () => String, minLength: 4, maxLength: 12 })
	@Index()
	@Column()
	phoneNumber: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (it) => it.phoneNumbers, {
		onDelete: 'CASCADE',
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeePhone) => it.employee)
	@Index()
	@Column()
	employeeId?: string;
}
