import { ApiProperty } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { ID, IEmployee, IEmployeeProposalTemplate } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmEmployeeProposalTemplateRepository } from './repository/mikro-orm-employee-proposal-template.repository';

@MultiORMEntity('employee_proposal_template', { mikroOrmRepository: () => MikroOrmEmployeeProposalTemplateRepository })
export class EmployeeProposalTemplate extends TenantOrganizationBaseEntity implements IEmployeeProposalTemplate {
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	@ApiProperty({ type: () => String })
	@ColumnIndex({ fulltext: true })
	@MultiORMColumn({ type: 'text', nullable: true })
	content?: string;

	@ApiProperty({ type: () => Boolean })
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToOne(() => Employee, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeProposalTemplate) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: ID;
}
