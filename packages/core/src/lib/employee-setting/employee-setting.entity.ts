import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import { RelationId } from 'typeorm';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
	IEmployeeSetting, IEmployee,
	EmployeeSettingTypeEnum,
	ID,
	BaseEntityEnum,
	JsonData
} from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmEmployeeSettingRepository } from './repository/mikro-orm-employee-setting.repository';

@MultiORMEntity('employee_setting', { mikroOrmRepository: () => MikroOrmEmployeeSettingRepository })
export class EmployeeSetting extends TenantOrganizationBaseEntity implements IEmployeeSetting {
	[EntityRepositoryType]?: MikroOrmEmployeeSettingRepository;

	@ApiPropertyOptional({ type: () => String, enum: EmployeeSettingTypeEnum })
	@IsEnum(EmployeeSettingTypeEnum)
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, default: EmployeeSettingTypeEnum.NORMAL })
	settingType?: EmployeeSettingTypeEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	entityId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: BaseEntityEnum })
	@IsOptional()
	@IsEnum(BaseEntityEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	entity?: BaseEntityEnum;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	data?: JsonData;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	defaultData?: JsonData;

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
	employeeId: ID;
}
