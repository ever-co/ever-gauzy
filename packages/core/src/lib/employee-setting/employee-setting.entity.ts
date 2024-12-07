import { RelationId } from 'typeorm';
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';

@MultiORMEntity('employee_setting', { mikroOrmRepository: () => MikroOrmEmployeeSettingRepository })
export class EmployeeSetting extends TenantOrganizationBaseEntity implements IEmployeeSetting {

	@ApiProperty({ type: () => Number, minimum: 1, maximum: 12 })
	@IsNumber()
	@IsNotEmpty()
	@Min(1)
	@Max(12)
	@MultiORMColumn()
	month: number;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@MultiORMColumn()
	year: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	settingType: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@MultiORMColumn()
	value: number;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	currency: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.settings, {
		onDelete: 'CASCADE'
	})
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeSetting) => it.employee)
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: string;
}
