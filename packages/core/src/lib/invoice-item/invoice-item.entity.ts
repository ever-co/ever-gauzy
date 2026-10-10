import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import {
	ID,
	IEmployee,
	IExpense,
	IInvoice,
	IInvoiceItem,
	IOrganizationProject,
	IProductTranslatable,
	ITask
} from '@gauzy/contracts';
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
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmInvoiceItemRepository } from './repository/mikro-orm-invoice-item.repository';

/**
 * One billed line.
 *
 * `purchaseOrderLineId` is the bill line's own provenance and the third of the three quantities a
 * three-way match needs; a separate match table would hold the same quantity twice. It is meaningful
 * only for a purchase bill, and the rule that keeps the sale-side bridge from setting it is a service
 * rule, because the database cannot express a check across three tables.
 */
@ColumnIndex('IDX_invoice_item_purchase_line', ['purchaseOrderLineId'], {
	where: '"purchaseOrderLineId" IS NOT NULL'
})
@MultiORMEntity('invoice_item', { mikroOrmRepository: () => MikroOrmInvoiceItemRepository })
export class InvoiceItem extends TenantOrganizationBaseEntity implements IInvoiceItem {
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	price: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	quantity: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	totalValue: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	applyTax?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ nullable: true })
	applyDiscount?: boolean;

	/**
	 * Which ordered line this bill line settles. Null on every existing row, and on a sales line: the
	 * match is what a purchase bill states, and a bill imported before the column existed is
	 * reconciled by the three-way audit rather than backfilled with a guessed match. The constraint is
	 * added by the purchasing package's set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	purchaseOrderLineId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	// Invoice Item Belongs to Expense
	@ApiPropertyOptional({ type: () => Expense })
	@MultiORMManyToOne(() => Expense, (expense) => expense.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	expense?: IExpense;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.expense)
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true, relationId: true })
	expenseId?: string;

	// Invoice Item Belongs to Invoice
	@ApiPropertyOptional({ type: () => Invoice })
	@MultiORMManyToOne(() => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.invoice)
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: string;

	// Invoice Item Belongs to Task
	@ApiPropertyOptional({ type: () => Task })
	@MultiORMManyToOne(() => Task, (task) => task.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.task)
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true, relationId: true })
	taskId?: string;

	// Invoice Item Belongs to Employee
	@ApiPropertyOptional({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, (employee) => employee.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.employee)
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: string;

	// Invoice Item Belongs to Project
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.invoiceItems, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: InvoiceItem) => it.project)
	@IsUUID()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: IOrganizationProject['id'];

	// Invoice Item Belongs to Product
	@ApiPropertyOptional({ type: () => Product })
	@MultiORMManyToOne(() => Product, (product) => product.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	product?: IProductTranslatable;

	@ApiPropertyOptional({ type: () => String })
	@RelationId((it: InvoiceItem) => it.product)
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true, relationId: true })
	productId?: string;
}
