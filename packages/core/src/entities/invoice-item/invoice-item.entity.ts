import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import {
	DeepPartial,
	IEmployee,
	IExpense,
	IInvoice,
	IInvoiceItem,
	IOrganizationProject,
	IProduct,
	ITask
} from '@gauzy/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';
import {
	Employee,
	Expense,
	Invoice,
	OrganizationProject,
	Product,
	Task,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('invoice_item')
export class InvoiceItem
	extends TenantOrganizationBaseEntity
	implements IInvoiceItem {
	constructor(input?: DeepPartial<InvoiceItem>) {
		super(input);
	}

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	name?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	description: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ type: 'numeric' })
	price: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ type: 'numeric' })
	quantity: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ type: 'numeric' })
	totalValue: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	invoiceId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	taskId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	employeeId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	projectId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	productId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	expenseId?: string;

	@ApiPropertyOptional({ type: Expense })
	@ManyToOne(() => Expense, (expense) => expense.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	expense?: IExpense;

	@ApiPropertyOptional({ type: Invoice })
	@ManyToOne(() => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: Task })
	@ManyToOne(() => Task, (task) => task.invoiceItems)
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: Employee })
	@ManyToOne(() => Employee, (employee) => employee.invoiceItems)
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.invoiceItems)
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: Product })
	@ManyToOne(() => Product, (product) => product.invoiceItems)
	@JoinColumn()
	product?: IProduct;

	@ApiPropertyOptional({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	applyTax?: boolean;

	@ApiPropertyOptional({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	applyDiscount?: boolean;
}
