import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne, ManyToMany } from 'typeorm';
import { Tag as ITag } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '../candidate/candidate.entity';
import { Employee } from '../employee/employee.entity';
import { Equipment } from '../equipment/equipment.entity';
import { EventType } from '../event-types/event-type.entity';
import { Income } from '../income/income.entity';
import { Expense } from '../expense/expense.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Task } from '../tasks/task.entity';
import { Proposal } from '../proposal/proposal.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { EmployeeLevel } from '../organization_employeeLevel/organization-employee-level.entity';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { Product } from '../product/product.entity';
import { Payment } from '../payment/payment.entity';

@Entity('tag')
export class Tag extends Base implements ITag {
	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;

	@ApiProperty()
	@ManyToOne((type) => Organization)
	organization?: Organization;

	@ApiProperty()
	@ManyToOne((type) => Tenant)
	tenant?: Tenant;

	@ManyToMany((type) => Candidate, (candidate) => candidate.tags)
	candidate?: Candidate[];

	@ManyToMany((type) => Employee, (employee) => employee.tags)
	employee?: Employee[];

	@ManyToMany((type) => Equipment, (equipment) => equipment.tags)
	equipment?: Equipment[];

	@ManyToMany((type) => EventType, (eventType) => eventType.tags)
	eventType?: EventType[];

	@ManyToMany((type) => Income, (income) => income.tags)
	income?: Income[];

	@ManyToMany((type) => Expense, (expense) => expense.tags)
	expense?: Expense[];

	@ManyToMany((type) => Invoice, (invoice) => invoice.tags)
	invoice?: Invoice[];

	@ManyToMany((type) => Task, (task) => task.tags)
	task?: Task[];

	@ManyToMany((type) => Proposal, (proposal) => proposal.tags)
	proposal?: Proposal[];

	@ManyToMany(
		(type) => OrganizationVendor,
		(organizationVendor) => organizationVendor.tags
	)
	organizationVendor?: OrganizationVendor[];

	@ManyToMany(
		(type) => OrganizationTeam,
		(organizationTeam) => organizationTeam.tags
	)
	organizationTeam?: OrganizationTeam[];

	@ManyToMany(
		(type) => OrganizationProjects,
		(organizationProject) => organizationProject.tags
	)
	organizationProject?: OrganizationProjects[];

	@ManyToMany(
		(type) => OrganizationPositions,
		(organizationPosition) => organizationPosition.tags
	)
	organizationPosition?: OrganizationPositions[];

	@ManyToMany(
		(type) => ExpenseCategory,
		(expenseCategory) => expenseCategory.tags
	)
	expenseCategory?: ExpenseCategory[];

	@ManyToMany(
		(type) => OrganizationEmploymentType,
		(organizationEmploymentType) => organizationEmploymentType.tags
	)
	organizationEmploymentType?: OrganizationEmploymentType[];

	@ManyToMany((type) => EmployeeLevel, (employeeLevel) => employeeLevel.tags)
	employeeLevel?: EmployeeLevel[];

	@ManyToMany(
		(type) => OrganizationDepartment,
		(organizationDepartment) => organizationDepartment.tags
	)
	organizationDepartment?: OrganizationDepartment[];

	@ManyToMany(
		(type) => OrganizationClients,
		(organizationClient) => organizationClient.tags
	)
	organizationClient?: OrganizationClients[];

	@ManyToMany((type) => Product, (product) => product.tags)
	product?: Product[];

	@ManyToMany((type) => Payment, (payment) => payment.tags)
	payment?: Payment[];
}
