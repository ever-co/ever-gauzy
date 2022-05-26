import {
	Column,
	Entity,
	Index,
	ManyToOne,
	RelationId,
	JoinColumn,
	ManyToMany,
	JoinTable,
	OneToMany
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsNumber,
	IsOptional,
	IsDate,
	IsEnum,
	IsBoolean
} from 'class-validator';
import {
	IExpense,
	CurrenciesEnum,
	IOrganizationVendor,
	IExpenseCategory,
	ITag,
	IEmployee,
	IOrganizationProject,
	IOrganizationContact,
	ExpenseStatusesEnum
} from '@gauzy/contracts';
import {
	Employee,
	ExpenseCategory,
	InvoiceItem,
	OrganizationContact,
	OrganizationProject,
	OrganizationVendor,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';

@Entity('expense')
export class Expense extends TenantOrganizationBaseEntity implements IExpense {
	
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	amount: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	typeOfExpense: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	purpose?: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	taxType?: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	taxLabel?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Index()
	@IsOptional()
	@Column({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	rateValue: number;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	receipt?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@IsOptional()
	@Column({ nullable: true })
	splitExpense: boolean;

	@ApiPropertyOptional({ type: () => String, maxLength: 256 })
	@IsOptional()
	@Column({ nullable: true })
	reference?: string;

	@ApiPropertyOptional({ type: () => String, enum: ExpenseStatusesEnum})
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: ExpenseStatusesEnum
	})
	status?: ExpenseStatusesEnum;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.expenses, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Expense) => it.employee)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	readonly employeeId?: string;

	/**
	 * OrganizationVendor
	 */
	@ApiProperty({ type: () => OrganizationVendor })
	@ManyToOne(() => OrganizationVendor, (vendor) => vendor.expenses, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	vendor: IOrganizationVendor;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Expense) => it.vendor)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly vendorId: string;

	/**
	 * ExpenseCategory
	 */
	@ApiProperty({ type: () => ExpenseCategory })
	@ManyToOne(() => ExpenseCategory, (category) => category.expenses, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	category: IExpenseCategory;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Expense) => it.category)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly categoryId: string;

	/**
	 * OrganizationProject
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.expenses, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Expense) => it.project)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	projectId?: string;

	/**
	 * OrganizationContact
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@ManyToOne(() => OrganizationContact, (contact) => contact.expenses, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: Expense) => it.organizationContact)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	organizationContactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * InvoiceItem
	 */
	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.expense, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: InvoiceItem[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Tag
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@ManyToMany(() => Tag, (tag) => tag.expenses, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_expense'
	})
	tags?: ITag[];
}
