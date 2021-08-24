import { Entity, Column, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import {
	IEmployee,
	IExpense,
	IInvoice,
	IInvoiceItem,
	IOrganizationProject,
	IProductTranslatable,
	ITask
} from '@gauzy/contracts';
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
} from '../core/entities/internal';

@Entity('invoice_item')
export class InvoiceItem
	extends TenantOrganizationBaseEntity
	implements IInvoiceItem {
	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	name?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ type: 'numeric' })
	price: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ type: 'numeric' })
	quantity: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ type: 'numeric' })
	totalValue: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	applyTax?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	applyDiscount?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	// Invoice Item Belongs to Expense
	@ApiPropertyOptional({ type: () => Expense })
	@ManyToOne(() => Expense, (expense) => expense.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	expense?: IExpense;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.expense)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	expenseId?: string;

	// Invoice Item Belongs to Invoice
	@ApiPropertyOptional({ type: () => Invoice })
	@ManyToOne(() => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.invoice)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	invoiceId?: string;

	// Invoice Item Belongs to Task
	@ApiPropertyOptional({ type: () => Task })
	@ManyToOne(() => Task, (task) => task.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.task)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	taskId?: string;

	// Invoice Item Belongs to Employee
	@ApiPropertyOptional({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.employee)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	employeeId?: string;

	// Invoice Item Belongs to Project
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.project)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	projectId?: string;

	// Invoice Item Belongs to Product
	@ApiPropertyOptional({ type: () => Product })
	@ManyToOne(() => Product, (product) => product.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	product?: IProductTranslatable;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.product)
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	productId?: string;
}
