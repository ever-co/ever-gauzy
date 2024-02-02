import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, ManyToMany, ManyToOne, RelationId, Index } from 'typeorm';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';

@MultiORMEntity('tag', { mikroOrmRepository: () => MikroOrmTagRepository })
export class Tag extends TenantOrganizationBaseEntity implements ITag {

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@Column()
	color: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	textColor?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	icon?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Column({ default: false })
	isSystem?: boolean;

	fullIconUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Team
	 */
	@ManyToOne(() => OrganizationTeam, (it) => it.labels, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Tag) => it.organizationTeam)
	@Index()
	@Column({ nullable: true })
	organizationTeamId?: IOrganizationTeam['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate
	 */
	@ManyToMany(() => Candidate, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	candidates?: ICandidate[];

	/**
	 * Employee
	 */
	@ManyToMany(() => Employee, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];

	/**
	 * Equipment
	 */
	@ManyToMany(() => Equipment, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	equipments?: IEquipment[];

	/**
	 * EventType
	 */
	@ManyToMany(() => EventType, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	eventTypes?: IEventType[];

	/**
	 * Income
	 */
	@ManyToMany(() => Income, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	incomes?: IIncome[];

	/**
	 * Expense
	 */
	@ManyToMany(() => Expense, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	expenses?: IExpense[];

	/**
	 * Invoice
	 */
	@ManyToMany(() => Invoice, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	invoices?: IInvoice[];

	/**
	 * Income
	 */
	@ManyToMany(() => Task, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	tasks?: ITask[];

	/**
	 * Proposal
	 */
	@ManyToMany(() => Proposal, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	proposals?: IProposal[];

	/**
	 * OrganizationVendor
	 */
	@ManyToMany(() => OrganizationVendor, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationVendors?: IOrganizationVendor[];

	/**
	 * OrganizationTeam
	 */
	@ManyToMany(() => OrganizationTeam, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationTeams?: IOrganizationTeam[];

	/**
	 * OrganizationProject
	 */
	@ManyToMany(() => OrganizationProject, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	organizationProjects?: IOrganizationProject[];

	/**
	 * OrganizationPosition
	 */
	@ManyToMany(() => OrganizationPosition, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationPositions?: IOrganizationPosition[];

	/**
	 * ExpenseCategory
	 */
	@ManyToMany(() => ExpenseCategory, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	expenseCategories?: IExpenseCategory[];

	/**
	 * OrganizationEmploymentType
	 */
	@ManyToMany(() => OrganizationEmploymentType, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	/**
	 * EmployeeLevel
	 */
	@ManyToMany(() => EmployeeLevel, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employeeLevels?: IEmployeeLevel[];

	/**
	 * OrganizationDepartment
	 */
	@ManyToMany(() => OrganizationDepartment, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationDepartments?: IOrganizationDepartment[];

	/**
	 * OrganizationContact
	 */
	@ManyToMany(() => OrganizationContact, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * Product
	 */
	@ManyToMany(() => Product, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	products?: IProduct[];

	/**
	 * Payment
	 */
	@ManyToMany(() => Payment, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	payments?: IPayment[];

	/**
	 * RequestApproval
	 */
	@ManyToMany(() => RequestApproval, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	requestApprovals?: IRequestApproval[];

	/**
	 * User
	 */
	@ManyToMany(() => User, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	users?: IUser[];

	/**
	 * Integration
	 */
	@ManyToMany(() => Integration, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	integrations?: IIntegration[];

	/**
	 * Merchant
	 */
	@ManyToMany(() => Merchant, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	merchants?: IMerchant[];

	/**
	 * Warehouse
	 */
	@ManyToMany(() => Warehouse, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	warehouses?: IWarehouse[];

	/**
	 * Organization
	 */
	@ManyToMany(() => Organization, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizations?: IOrganization[];
}
