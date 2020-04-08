import {
	Column,
	Entity,
	Index,
	ManyToOne,
	RelationId,
	JoinColumn,
	ManyToMany,
	JoinTable
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
import { Base } from '../core/entities/base';
import { Expense as IExpense, CurrenciesEnum } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { Tag } from '../tags/tag.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';

@Entity('expense')
export class Expense extends Base implements IExpense {
	@ApiProperty({ type: Tag })
	@ManyToMany((type) => Tag)
	@JoinTable({
		name: 'tag_expense'
	})
	tags: Tag[];

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((expense: Expense) => expense.employee)
	@Column({ nullable: true })
	readonly employeeId?: string;

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((expense: Expense) => expense.organization)
	readonly orgId: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'numeric' })
	amount: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	typeOfExpense: string;

	@ApiProperty({ type: OrganizationVendor })
	@ManyToOne((type) => OrganizationVendor, {
		nullable: false
	})
	@JoinColumn()
	vendor: OrganizationVendor;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((expense: Expense) => expense.vendor)
	readonly vendorId: string;

	@ApiProperty({ type: ExpenseCategory })
	@ManyToOne((type) => ExpenseCategory, {
		nullable: false
	})
	@JoinColumn()
	category: ExpenseCategory;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((expense: Expense) => expense.category)
	readonly categoryId: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	clientId?: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	clientName?: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	projectId?: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	projectName?: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsNotEmpty()
	@Index()
	@Column()
	currency: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	purpose?: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	taxType?: string;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	taxLabel?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Index()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	rateValue: number;

	@ApiPropertyOptional({ type: String })
	@Index()
	@IsOptional()
	@Column({ nullable: true })
	receipt?: string;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@IsOptional()
	@Column({ nullable: true })
	splitExpense: boolean;

	@ApiPropertyOptional({ type: String, maxLength: 256 })
	@IsOptional()
	@Column({ nullable: true })
	reference?: string;

	//IN SOME CASES THE EXPENSES ARE CRASHING BECAUZE ITS TRYING TO ADD EXPENSEID AND THERE IS NO SUCH THING

	// IF THIS HAPPENS AGAIN ADD THIS

	// @ApiPropertyOptional({ type: String})
	// @IsOptional()
	// @Column({ nullable: true })
	// expenseId?: string;
}
