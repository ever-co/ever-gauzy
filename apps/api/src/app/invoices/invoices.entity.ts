import { Invoice as IInvoice, CurrenciesEnum } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsBoolean, IsDate } from 'class-validator';
import { Entity, Column, JoinColumn, OneToOne, OneToMany } from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { InvoiceItem } from '../invoice-item';

@Entity('invoice')
export class Invoice extends Base implements IInvoice {
	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	invoiceDate: Date;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	invoiceNumber: number;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	dueDate: Date;

	@ApiProperty({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column()
	currency: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	discountValue: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	paid: boolean;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	tax: number;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	terms: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	totalValue: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	emailSent: boolean;

	@ApiPropertyOptional({ type: Organization })
	@OneToOne((type) => Organization, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	fromOrganization?: Organization;

	@ApiPropertyOptional({ type: OrganizationClients })
	@OneToOne((type) => OrganizationClients, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	toClient?: OrganizationClients;

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany(
		(type) => InvoiceItem,
		(invoiceItem) => invoiceItem.invoices
	)
	@JoinColumn()
	invoiceItems?: InvoiceItem[];
}
