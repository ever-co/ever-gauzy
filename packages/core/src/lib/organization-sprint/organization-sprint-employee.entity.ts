import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, IOrganizationSprintEmployee, IRole } from '@gauzy/contracts';
import { Employee, OrganizationSprint, Role, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmOrganizationSprintEmployeeRepository } from './repository/mikro-orm-organization-sprint-employee.repository';

@MultiORMEntity('organization_sprint_employee', {
	mikroOrmRepository: () => MikroOrmOrganizationSprintEmployeeRepository
})
export class OrganizationSprintEmployee extends TenantOrganizationBaseEntity implements IOrganizationSprintEmployee {
	// Manager of the organization project
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isManager?: boolean;

	// Assigned At Manager of the organization project
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	assignedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationSprint
	 */
	@MultiORMManyToOne(() => OrganizationSprint, (it) => it.members, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationSprint!: OrganizationSprint;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintEmployee) => it.organizationSprint)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationSprintId: ID;

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.sprints, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee!: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationSprintEmployee) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: ID;

	/**
	 * Role
	 */
	@MultiORMManyToOne(() => Role, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	role!: IRole;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationSprintEmployee) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: ID;
}
