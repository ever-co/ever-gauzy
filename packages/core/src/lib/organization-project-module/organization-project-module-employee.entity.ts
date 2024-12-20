import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, IOrganizationProjectModuleEmployee, IRole } from '@gauzy/contracts';
import { Employee, OrganizationProjectModule, Role, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { MikroOrmOrganizationProjectModuleEmployeeRepository } from './repository/mikro-orm-organization-project-module-employee.repository';

@MultiORMEntity('organization_project_module_employee', {
	mikroOrmRepository: () => MikroOrmOrganizationProjectModuleEmployeeRepository
})
export class OrganizationProjectModuleEmployee
	extends TenantOrganizationBaseEntity
	implements IOrganizationProjectModuleEmployee
{
	// Manager of the organization project module
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: Boolean, nullable: true, default: false })
	isManager?: boolean;

	// Assigned At Manager of the organization project module
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
	 * OrganizationProjectModule
	 */
	@MultiORMManyToOne(() => OrganizationProjectModule, (it) => it.members, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationProjectModule!: OrganizationProjectModule;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationProjectModuleEmployee) => it.organizationProjectModule)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	organizationProjectModuleId: ID;

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.modules, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee!: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationProjectModuleEmployee) => it.employee)
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
	@RelationId((it: OrganizationProjectModuleEmployee) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: ID;
}
