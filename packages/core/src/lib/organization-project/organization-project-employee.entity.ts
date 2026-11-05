import { RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { billingRateColumn } from '../shared/pipes/billing-rate.transform';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, IOrganizationProject, IOrganizationProjectEmployee, IRole } from '@gauzy/contracts';
import { Employee, OrganizationProject, Role, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmOrganizationProjectEmployeeRepository } from './repository/mikro-orm-organization-project-employee.repository';

@MultiORMEntity('organization_project_employee', {
	mikroOrmRepository: () => MikroOrmOrganizationProjectEmployeeRepository
})
export class OrganizationProjectEmployee extends TenantOrganizationBaseEntity implements IOrganizationProjectEmployee {
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

	/**
	 * The member's client rate on this project: what the client is billed per hour of their time on it, in the
	 * project's currency, over the project's client rate. It does not change what the member is paid. Written and read
	 * through the project rate routes only, which check who may and answer plain objects: generic project and member
	 * reads never answer it, even for a caller `select` naming it.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		nullable: true,
		description:
			"What the client is billed per hour of this member's time on the project, in the project's currency"
	})
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ ...billingRateColumn(), select: false, hidden: true })
	billRateValue?: number | null;

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
	organizationProject!: IOrganizationProject;

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
	employee!: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: OrganizationProjectEmployee) => it.employee)
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
	@RelationId((it: OrganizationProjectEmployee) => it.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: ID;
}
