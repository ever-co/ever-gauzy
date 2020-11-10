import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import {
	IEmployee,
	IExpense,
	IInvoice,
	IInvoiceItem,
	IOrganizationProject,
	IProduct,
	ITask
} from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Invoice } from '../invoice/invoice.entity';
import { Task } from '../tasks/task.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import { Product } from '../product/product.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { Expense } from '../expense/expense.entity';

@Entity('invoice_item')
export class InvoiceItem
	extends TenantOrganizationBase
	implements IInvoiceItem {
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
	@ManyToOne((type) => Expense, (expense) => expense.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	expense?: IExpense;

	@ApiPropertyOptional({ type: Invoice })
	@ManyToOne((type) => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: Task })
	@ManyToOne((type) => Task, (task) => task.invoiceItems)
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: Employee })
	@ManyToOne((type) => Employee, (employee) => employee.invoiceItems)
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: OrganizationProject })
	@ManyToOne((type) => OrganizationProject, (project) => project.invoiceItems)
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: Product })
	@ManyToOne((type) => Product, (product) => product.invoiceItems)
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
