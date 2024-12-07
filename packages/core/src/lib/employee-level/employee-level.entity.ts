import { JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { IEmployeeLevel, ITag } from '@gauzy/contracts';
import { Tag, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany } from './../core/decorators/entity';
import { MikroOrmEmployeeLevelRepository } from './repository/mikro-orm-employee-level.repository';

@MultiORMEntity('employee_level', { mikroOrmRepository: () => MikroOrmEmployeeLevelRepository })
export class EmployeeLevel extends TenantOrganizationBaseEntity implements IEmployeeLevel {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	level: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tag
	 */
	@MultiORMManyToMany(() => Tag, (it) => it.employeeLevels, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_employee_level',
		joinColumn: 'employeeLevelId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_employee_level'
	})
	tags?: ITag[];
}
