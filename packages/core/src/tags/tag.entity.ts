import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
	ICandidate,
	IEmployee,
	IEmployeeLevel,
	IEquipment,
	IEventType,
	IExpense,
	IExpenseCategory,
	IIncome,
	IIntegration,
	IInvoice,
	IMerchant,
	IOrganization,
	IOrganizationContact,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IOrganizationPosition,
	IOrganizationProject,
	IOrganizationTeam,
	IOrganizationVendor,
	IPayment,
	IProduct,
	IProposal,
	IRequestApproval,
	ITag,
	ITask,
	IUser,
	IWarehouse
} from '@gauzy/contracts';
import {
	Candidate,
	Employee,
	EmployeeLevel,
	Equipment,
	EventType,
	Expense,
	ExpenseCategory,
	Income,
	Integration,
	Invoice,
	Merchant,
	Organization,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPositions,
	OrganizationProject,
	OrganizationTeam,
	OrganizationVendor,
	Payment,
	Product,
	Proposal,
	RequestApproval,
	Task,
	TenantOrganizationBaseEntity,
	User,
	Warehouse
} from '../core/entities/internal';

@Entity('tag')
export class Tag extends TenantOrganizationBaseEntity implements ITag {
	@ApiProperty({ type: () => String })
	@Column()
	name?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@Column()
	color?: string;

	@ApiProperty({ type: () => Boolean, default: false })
	@Column({ default: false })
	isSystem?: boolean;

	@ManyToMany(() => Candidate, (candidate) => candidate.tags)
	@JoinTable({
		name: 'tag_candidate'
	})
	candidate?: ICandidate[];

	@ManyToMany(() => Employee, (employee) => employee.tags)
	employee?: IEmployee[];

	@ManyToMany(() => Equipment, (equipment) => equipment.tags)
	equipment?: IEquipment[];

	@ManyToMany(() => EventType, (eventType) => eventType.tags)
	eventType?: IEventType[];

	@ManyToMany(() => Income, (income) => income.tags)
	income?: IIncome[];

	@ManyToMany(() => Expense, (expense) => expense.tags)
	expense?: IExpense[];

	@ManyToMany(() => Invoice, (invoice) => invoice.tags)
	@JoinTable({
		name: 'tag_invoice'
	})
	invoice?: IInvoice[];

	@ManyToMany(() => Task, (task) => task.tags)
	@JoinTable({
		name: 'tag_task'
	})
	task?: ITask[];

	@ManyToMany(() => Proposal, (proposal) => proposal.tags)
	@JoinTable({ name: 'tag_proposal' })
	proposal?: IProposal[];

	@ManyToMany(
		() => OrganizationVendor,
		(organizationVendor) => organizationVendor.tags
	)
	organizationVendor?: IOrganizationVendor[];

	@ManyToMany(
		() => OrganizationTeam,
		(organizationTeam) => organizationTeam.tags
	)
	organizationTeam?: IOrganizationTeam[];

	@ManyToMany(() => OrganizationProject, (organizationProject) => organizationProject.tags, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_project'
	})
	organizationProject?: IOrganizationProject[];

	@ManyToMany(
		() => OrganizationPositions,
		(organizationPosition) => organizationPosition.tags
	)
	organizationPosition?: IOrganizationPosition[];

	@ManyToMany(
		() => ExpenseCategory,
		(expenseCategory) => expenseCategory.tags
	)
	expenseCategory?: IExpenseCategory[];

	@ManyToMany(
		() => OrganizationEmploymentType,
		(organizationEmploymentType) => organizationEmploymentType.tags
	)
	organizationEmploymentType?: IOrganizationEmploymentType[];

	@ManyToMany(() => EmployeeLevel, (employeeLevel) => employeeLevel.tags)
	employeeLevel?: IEmployeeLevel[];

	@ManyToMany(
		() => OrganizationDepartment,
		(organizationDepartment) => organizationDepartment.tags
	)
	organizationDepartment?: IOrganizationDepartment[];

	@ManyToMany(
		() => OrganizationContact,
		(organizationContact) => organizationContact.tags
	)
	organizationContact?: IOrganizationContact[];

	@ManyToMany(() => Product, (product) => product.tags)
	product?: IProduct[];

	@ManyToMany(() => Payment, (payment) => payment.tags)
	payment?: IPayment[];

	@ManyToMany(
		() => RequestApproval,
		(requestApproval) => requestApproval.tags
	)
	requestApproval?: IRequestApproval[];

	@ManyToMany(() => User)
	@JoinTable({
		name: 'tag_user'
	})
	users?: IUser[];

	@ManyToMany(() => Integration)
	@JoinTable({
		name: 'tag_integration'
	})
	integrations?: IIntegration[];

	@ManyToMany(() => Merchant, (merchant) => merchant.tags)
	merchants?: IMerchant[];

	@ManyToMany(() => Warehouse, (warehouse) => warehouse.tags)
	warehouses?: IWarehouse[];

	// organizations Tags
	@ManyToMany(() => Organization, (organization) => organization.tags)
    @JoinTable({
		name: 'tag_organization'
	})
    organizations?: IOrganization[];
}
