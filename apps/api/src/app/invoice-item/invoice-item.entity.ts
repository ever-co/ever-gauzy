import { Base } from '../core/entities/base';
import { Entity, Column, OneToMany, JoinColumn } from 'typeorm';
import { InvoiceItem as IInvoiceItem } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { Invoice } from '../invoices';

@Entity('invoice_item')
export class InvoiceItem extends Base implements IInvoiceItem {
	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	itemNumber?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@Column({ nullable: true })
	name?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	unitCost?: number;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	quantity?: number;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	invoiceId: string;

	@ApiPropertyOptional({ type: Invoice, isArray: true })
	@OneToMany(
		(type) => Invoice,
		(invoice) => invoice.invoiceDate
	)
	@JoinColumn()
	invoices?: Invoice[];
}
