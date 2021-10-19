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
	OrganizationPosition,
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

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate, isArray: true })
	@ManyToMany(() => Candidate, (candidate) => candidate.tags, {
		onDelete: 'CASCADE'
	})
	candidates?: ICandidate[];

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee, isArray: true })
	@ManyToMany(() => Employee, (employee) => employee.tags, {
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];

	/**
	 * Equipment
	 */
	@ApiProperty({ type: () => Equipment, isArray: true })
	@ManyToMany(() => Equipment, (equipment) => equipment.tags, {
		onDelete: 'CASCADE'
	})
	equipments?: IEquipment[];

	/**
	 * EventType
	 */
	@ApiProperty({ type: () => EventType, isArray: true })
	@ManyToMany(() => EventType, (eventType) => eventType.tags, {
		onDelete: 'CASCADE'
	})
	eventTypes?: IEventType[];

	/**
	 * Income
	 */
	@ApiProperty({ type: () => Income, isArray: true })
	@ManyToMany(() => Income, (income) => income.tags, {
		onDelete: 'CASCADE'
	})
	incomes?: IIncome[];

	/**
	 * Expense
	 */
	@ApiProperty({ type: () => Expense, isArray: true })
	@ManyToMany(() => Expense, (expense) => expense.tags, {
		onDelete: 'CASCADE'
	})
	expenses?: IExpense[];

	/**
	 * Invoice
	 */
	@ApiProperty({ type: () => Invoice, isArray: true })
	@ManyToMany(() => Invoice, (invoice) => invoice.tags, {
		onDelete: 'CASCADE'
	})
	invoices?: IInvoice[];

	/**
	 * Income
	 */
	@ApiProperty({ type: () => Task, isArray: true })
	@ManyToMany(() => Task, (task) => task.tags, {
		onDelete: 'CASCADE'
	})
	tasks?: ITask[];

	/**
	 * Proposal
	 */
	@ApiProperty({ type: () => Proposal, isArray: true })
	@ManyToMany(() => Proposal, (proposal) => proposal.tags, {
		onDelete: 'CASCADE'
	})
	proposals?: IProposal[];

	/**
	 * OrganizationVendor
	 */
	@ApiProperty({ type: () => OrganizationVendor, isArray: true })
	@ManyToMany(() => OrganizationVendor, (organizationVendor) => organizationVendor.tags, {
		onDelete: 'CASCADE'
	})
	organizationVendors?: IOrganizationVendor[];

	/**
	 * OrganizationTeam
	 */
	@ApiProperty({ type: () => OrganizationTeam, isArray: true })
	@ManyToMany(() => OrganizationTeam, (organizationTeam) => organizationTeam.tags, {
		onDelete: 'CASCADE'
	})
	organizationTeams?: IOrganizationTeam[];

	/**
	 * OrganizationProject
	 */
	@ApiProperty({ type: () => OrganizationProject, isArray: true })
	@ManyToMany(() => OrganizationProject, (organizationProject) => organizationProject.tags, {
		onDelete: 'CASCADE'
	})
	organizationProjects?: IOrganizationProject[];

	/**
	 * OrganizationPosition
	 */
	@ApiProperty({ type: () => OrganizationPosition, isArray: true })
	@ManyToMany(() => OrganizationPosition, (organizationPosition) => organizationPosition.tags, {
		onDelete: 'CASCADE'
	})
	organizationPositions?: IOrganizationPosition[];

	/**
	 * ExpenseCategory
	 */
	@ApiProperty({ type: () => ExpenseCategory, isArray: true })
	@ManyToMany(() => ExpenseCategory, (expenseCategory) => expenseCategory.tags, {
		onDelete: 'CASCADE'
	})
	expenseCategories?: IExpenseCategory[];

	/**
	 * OrganizationEmploymentType
	 */
	@ApiProperty({ type: () => OrganizationEmploymentType, isArray: true })
	@ManyToMany(() => OrganizationEmploymentType, (organizationEmploymentType) => organizationEmploymentType.tags, {
		onDelete: 'CASCADE'
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	/**
	 * EmployeeLevel
	 */
	@ApiProperty({ type: () => EmployeeLevel, isArray: true })
	@ManyToMany(() => EmployeeLevel, (employeeLevel) => employeeLevel.tags, {
		onDelete: 'CASCADE'
	})
	employeeLevels?: IEmployeeLevel[];

	/**
	 * OrganizationDepartment
	 */
	@ApiProperty({ type: () => OrganizationDepartment, isArray: true })
	@ManyToMany(() => OrganizationDepartment, (organizationDepartment) => organizationDepartment.tags, {
		onDelete: 'CASCADE'
	})
	organizationDepartments?: IOrganizationDepartment[];

	/**
	 * OrganizationContact
	 */
	@ApiProperty({ type: () => OrganizationContact, isArray: true })
	@ManyToMany(() => OrganizationContact, (organizationContact) => organizationContact.tags, {
		onDelete: 'CASCADE'
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * Product
	 */
	@ApiProperty({ type: () => Product, isArray: true })
	@ManyToMany(() => Product, (product) => product.tags, {
		onDelete: 'CASCADE'
	})
	products?: IProduct[];

	/**
	 * Payment
	 */
	@ApiProperty({ type: () => Payment, isArray: true })
	@ManyToMany(() => Payment, (payment) => payment.tags, {
		onDelete: 'CASCADE'
	})
	payments?: IPayment[];

	/**
	 * RequestApproval
	 */
	@ApiProperty({ type: () => RequestApproval, isArray: true })
	@ManyToMany(() => RequestApproval, (requestApproval) => requestApproval.tags, {
		onDelete: 'CASCADE'
	})
	requestApprovals?: IRequestApproval[];

	/**
	 * User
	 */
	@ApiProperty({ type: () => User, isArray: true })
	@ManyToMany(() => User, (user) => user.tags, {
		onDelete: 'CASCADE'
	})
	users?: IUser[];

	/**
	 * Integration
	 */
	@ApiProperty({ type: () => Integration, isArray: true })
	@ManyToMany(() => Integration, (integration) => integration.tags, {
		onDelete: 'CASCADE'
	})
	integrations?: IIntegration[];

	/**
	 * Merchant
	 */
	@ApiProperty({ type: () => Merchant, isArray: true })
	@ManyToMany(() => Merchant, (merchant) => merchant.tags, {
		onDelete: 'CASCADE'
	})
	merchants?: IMerchant[];

	/**
	 * Warehouse
	 */
	@ApiProperty({ type: () => Warehouse, isArray: true })
	@ManyToMany(() => Warehouse, (warehouse) => warehouse.tags, {
		onDelete: 'CASCADE'
	})
	warehouses?: IWarehouse[];

	/**
	 * Organization
	 */
	@ApiProperty({ type: () => Organization, isArray: true })
	@ManyToMany(() => Organization, (organization) => organization.tags, {
		onDelete: 'CASCADE'
	})
    organizations?: IOrganization[];
}
