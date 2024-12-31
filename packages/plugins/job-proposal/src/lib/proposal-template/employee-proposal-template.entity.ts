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
	/**
	 * The name/title of the proposal template (e.g., "General Proposal", "Technical Proposal").
	 */
	@ApiProperty({ type: () => String })
	@ColumnIndex() // Adds an index on the 'name' column for faster queries
	@MultiORMColumn()
	name?: string;

	/**
	 * The main content or body of the proposal template.
	 * Marked as 'text' type, and set to nullable for optional usage.
	 * Also, 'fulltext: true' enables full-text search if supported by the database.
	 */
	@ApiProperty({ type: () => String })
	@ColumnIndex({ fulltext: true })
	@MultiORMColumn({ type: 'text', nullable: true })
	content?: string;

	/**
	 * Indicates if this template is the default template for the employee/tenant combination.
	 * Defaults to 'false' when newly created.
	 */
	@ApiProperty({ type: () => Boolean })
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isDefault?: boolean;

	/*
	|----------------------------------------------------------------------
	| @ManyToOne
	|----------------------------------------------------------------------
	*/

	/**
	 * Many-to-one relationship linking this template to a specific employee.
	 * If the employee is deleted, this template is deleted as well (cascade).
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	/**
	 * Stores the UUID of the linked employee.
	 * This is automatically populated via `@RelationId` from the `employee` relation.
	 */
	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeProposalTemplate) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: ID;
}
