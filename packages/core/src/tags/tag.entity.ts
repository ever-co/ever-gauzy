import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/core';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CustomEmbeddedFields } from '@gauzy/common';
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
import { CustomTagFields } from '../core/entities/custom-entity-fields/custom-entity-fields';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne, VirtualMultiOrmColumn } from '../core/decorators/entity';
import { MikroOrmTagRepository } from './repository/mikro-orm-tag.repository';

@MultiORMEntity('tag', { mikroOrmRepository: () => MikroOrmTagRepository })
export class Tag extends TenantOrganizationBaseEntity implements ITag {

	[EntityRepositoryType]?: MikroOrmTagRepository;

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	color: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	textColor?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	icon?: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@MultiORMColumn({ default: false })
	isSystem?: boolean;

	@VirtualMultiOrmColumn()
	fullIconUrl?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Team
	 */
	@MultiORMManyToOne(() => OrganizationTeam, (it) => it.labels, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Tag) => it.organizationTeam)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationTeamId?: IOrganizationTeam['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Candidate
	 */
	@MultiORMManyToMany(() => Candidate, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	candidates?: ICandidate[];

	/**
	 * Employee
	 */
	@MultiORMManyToMany(() => Employee, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];

	/**
	 * Equipment
	 */
	@MultiORMManyToMany(() => Equipment, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	equipments?: IEquipment[];

	/**
	 * EventType
	 */
	@MultiORMManyToMany(() => EventType, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	eventTypes?: IEventType[];

	/**
	 * Income
	 */
	@MultiORMManyToMany(() => Income, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	incomes?: IIncome[];

	/**
	 * Expense
	 */
	@MultiORMManyToMany(() => Expense, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	expenses?: IExpense[];

	/**
	 * Invoice
	 */
	@MultiORMManyToMany(() => Invoice, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	invoices?: IInvoice[];

	/**
	 * Income
	 */
	@MultiORMManyToMany(() => Task, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	tasks?: ITask[];

	/**
	 * Proposal
	 */
	@MultiORMManyToMany(() => Proposal, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	proposals?: IProposal[];

	/**
	 * OrganizationVendor
	 */
	@MultiORMManyToMany(() => OrganizationVendor, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationVendors?: IOrganizationVendor[];

	/**
	 * OrganizationTeam
	 */
	@MultiORMManyToMany(() => OrganizationTeam, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationTeams?: IOrganizationTeam[];

	/**
	 * OrganizationProject
	 */
	@MultiORMManyToMany(() => OrganizationProject, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
	})
	organizationProjects?: IOrganizationProject[];

	/**
	 * OrganizationPosition
	 */
	@MultiORMManyToMany(() => OrganizationPosition, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationPositions?: IOrganizationPosition[];

	/**
	 * ExpenseCategory
	 */
	@MultiORMManyToMany(() => ExpenseCategory, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	expenseCategories?: IExpenseCategory[];

	/**
	 * OrganizationEmploymentType
	 */
	@MultiORMManyToMany(() => OrganizationEmploymentType, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationEmploymentTypes?: IOrganizationEmploymentType[];

	/**
	 * EmployeeLevel
	 */
	@MultiORMManyToMany(() => EmployeeLevel, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employeeLevels?: IEmployeeLevel[];

	/**
	 * OrganizationDepartment
	 */
	@MultiORMManyToMany(() => OrganizationDepartment, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationDepartments?: IOrganizationDepartment[];

	/**
	 * OrganizationContact
	 */
	@MultiORMManyToMany(() => OrganizationContact, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * Product
	 */
	@MultiORMManyToMany(() => Product, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	products?: IProduct[];

	/**
	 * Payment
	 */
	@MultiORMManyToMany(() => Payment, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	payments?: IPayment[];

	/**
	 * RequestApproval
	 */
	@MultiORMManyToMany(() => RequestApproval, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	requestApprovals?: IRequestApproval[];

	/**
	 * User
	 */
	@MultiORMManyToMany(() => User, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	users?: IUser[];

	/**
	 * Integration
	 */
	@MultiORMManyToMany(() => Integration, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	integrations?: IIntegration[];

	/**
	 * Merchant
	 */
	@MultiORMManyToMany(() => Merchant, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	merchants?: IMerchant[];

	/**
	 * Warehouse
	 */
	@MultiORMManyToMany(() => Warehouse, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	warehouses?: IWarehouse[];

	/**
	 * Organization
	 */
	@MultiORMManyToMany(() => Organization, (it) => it.tags, {
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	organizations?: IOrganization[];

	/*
	|--------------------------------------------------------------------------
	| Custom Entity Fields
	|--------------------------------------------------------------------------
	*/
	@Column(() => CustomTagFields)
	customFields?: CustomEmbeddedFields;
}
