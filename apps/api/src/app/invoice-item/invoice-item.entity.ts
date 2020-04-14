import { Base } from '../core/entities/base';
import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { InvoiceItem as IInvoiceItem } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Invoice } from '../invoice/invoice.entity';
import { Task } from '../tasks/task.entity';

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
	unitCost: number;

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
	task?: InvoiceItem;
}
