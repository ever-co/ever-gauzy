import { Base } from '../core/entities/base';
import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { InvoiceItem as IInvoiceItem } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Invoice } from '../invoice/invoice.entity';
import { Task } from '../tasks/task.entity';
import { Employee } from '../employee/employee.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Product } from '../product/product.entity';

@Entity('invoice_item')
export class InvoiceItem extends Base implements IInvoiceItem {
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

	@ApiPropertyOptional({ type: Invoice })
	@ManyToOne(
		(type) => Invoice,
		(invoice) => invoice.invoiceItems,
		{ onDelete: 'SET NULL' }
	)
	@JoinColumn()
	invoice?: Invoice;

	@ApiPropertyOptional({ type: Task })
	@ManyToOne(
		(type) => Task,
		(task) => task.invoiceItems
	)
	@JoinColumn()
	task?: Task;

	@ApiPropertyOptional({ type: Employee })
	@ManyToOne(
		(type) => Employee,
		(employee) => employee.invoiceItems
	)
	@JoinColumn()
	employee?: Employee;

	@ApiPropertyOptional({ type: OrganizationProjects })
	@ManyToOne(
		(type) => OrganizationProjects,
		(project) => project.invoiceItems
	)
	@JoinColumn()
	project?: OrganizationProjects;

	@ApiPropertyOptional({ type: Product })
	@ManyToOne(
		(type) => Product,
		(product) => product.invoiceItems
	)
	@JoinColumn()
	product?: Product;
}
