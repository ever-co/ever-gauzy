import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, IOrganizationProjectEmployee, IRole } from '@gauzy/contracts';
import { Employee, OrganizationProject, Role, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmOrganizationProjectEmployeeRepository } from './repository/mikro-orm-organization-project-employee.repository';

@MultiORMEntity('organization_project_employee', {
	mikroOrmRepository: () => MikroOrmOrganizationProjectEmployeeRepository
})
export class OrganizationProjectEmployee extends TenantOrganizationBaseEntity implements IOrganizationProjectEmployee {
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationProject
	 */
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.members, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationProject!: IOrganizationProjectEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationProjectEmployee) => it.organizationProject)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationProjectId: ID;

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.projects, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationProjectEmployee) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/**
	 * Role
	 */
	@MultiORMManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	role?: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProjectEmployee) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: ID;
}
