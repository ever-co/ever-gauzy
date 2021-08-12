import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	Min,
	Max,
	IsEnum
} from 'class-validator';
import { IEmployeeSetting, CurrenciesEnum, IEmployee } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('employee_setting')
export class EmployeeSetting
	extends TenantOrganizationBaseEntity
	implements IEmployeeSetting {

	@ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
	@IsNumber()
	@IsNotEmpty()
	@Min(1)
	@Max(12)
	@Column()
	month: number;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Column()
	year: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	settingType: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@Column()
	value: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.settings, {
		onDelete: 'CASCADE'
	})
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeSetting) => it.employee)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	employeeId: string;
}
