import { Column, JoinColumn, ManyToOne, RelationId } from 'typeorm';
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
import { IsNumber, IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import {
	Employee,
	Expense,
	Invoice,
	OrganizationProject,
	Product,
	Task,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmInvoiceItemRepository } from './repository/mikro-orm-invoice-item.repository';

@MultiORMEntity('invoice_item', { mikroOrmRepository: () => MikroOrmInvoiceItemRepository })
export class InvoiceItem extends TenantOrganizationBaseEntity implements IInvoiceItem {

	@ApiProperty({ type: () => String })
	@IsString()
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	price: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	quantity: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
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
	@ManyToOne(() => OrganizationProject, (it) => it.invoiceItems, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: InvoiceItem) => it.project)
	@IsUUID()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

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
