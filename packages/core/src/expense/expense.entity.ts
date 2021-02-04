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
	IOrganizationProject
} from '@gauzy/contracts';
import {
	Employee,
	ExpenseCategory,
	InvoiceItem,
	OrganizationProject,
	OrganizationVendor,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('expense')
export class Expense extends TenantOrganizationBaseEntity implements IExpense {
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (tag) => tag.expense)
	@JoinTable({
		name: 'tag_expense'
	})
	tags: ITag[];

	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((expense: Expense) => expense.employee)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	amount: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	typeOfExpense: string;

	@ApiProperty({ type: () => OrganizationVendor })
	@ManyToOne(() => OrganizationVendor, {
		nullable: false
	})
	@JoinColumn()
	vendor: IOrganizationVendor;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((expense: Expense) => expense.vendor)
	readonly vendorId: string;

	@ApiProperty({ type: () => ExpenseCategory })
	@ManyToOne(() => ExpenseCategory, {
		nullable: false
	})
	@JoinColumn()
	category: IExpenseCategory;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((expense: Expense) => expense.category)
	readonly categoryId: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	organizationContactId?: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	organizationContactName?: string;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	@RelationId((expense: Expense) => expense.project)
	projectId?: string;

	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, {
		nullable: false
	})
	@JoinColumn()
	project: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	projectName?: string;

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
	@Column({ nullable: true, type: 'numeric' })
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	status?: string;

	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.expense, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: InvoiceItem[];

	//IN SOME CASES THE EXPENSES ARE CRASHING BECAUSE ITS TRYING TO ADD EXPENSES AND THERE IS NO SUCH THING

	// IF THIS HAPPENS AGAIN ADD THIS

	// @ApiPropertyOptional({ type: () => String})
	// @IsOptional()
	// @Column({ nullable: true })
	// expenseId?: string;
}
