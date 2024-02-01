import { Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IEmployeeLevel, ITag } from '@gauzy/contracts';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEmployeeLevelRepository } from './repository/mikro-orm-employee-level.repository';

@MultiORMEntity('employee_level', { mikroOrmRepository: () => MikroOrmEmployeeLevelRepository })
export class EmployeeLevel extends TenantOrganizationBaseEntity implements IEmployeeLevel {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	level: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tag
	 */
	@ManyToMany(() => Tag, (it) => it.employeeLevels, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_employee_level'
	})
	tags?: ITag[];
}
