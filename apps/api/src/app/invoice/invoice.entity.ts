import {
	Invoice as IInvoice,
	CurrenciesEnum,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum
} from '@gauzy/models';
import { Base } from '../core/entities/base';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	IsNumber,
	IsBoolean,
	IsDate,
	IsOptional,
	IsEnum
} from 'class-validator';
import {
	Entity,
	Column,
	JoinColumn,
	OneToMany,
	ManyToOne,
	Unique,
	ManyToMany,
	JoinTable
} from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { Payment } from '../payment/payment.entity';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('invoice')
@Unique(['invoiceNumber'])
export class Invoice extends TenantBase implements IInvoice {
	@ApiProperty({ type: Tag })
	@ManyToMany((type) => Tag, (tag) => tag.invoice)
	@JoinTable({
		name: 'tag_invoice'
	})
	tags?: Tag[];

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	invoiceDate: Date;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ name: 'invoiceNumber', nullable: true, type: 'numeric' })
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
	@Column({ type: 'numeric' })
	discountValue: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	paid: boolean;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true, type: 'numeric' })
	tax: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	terms?: string;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	totalValue?: number;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	sentStatus?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isEstimate?: boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	isAccepted?: boolean;

	@ApiProperty({ type: String, enum: DiscountTaxTypeEnum })
	@IsEnum(DiscountTaxTypeEnum)
	@Column({ nullable: true })
	discountType: string;

	@ApiProperty({ type: String, enum: DiscountTaxTypeEnum })
	@IsEnum(DiscountTaxTypeEnum)
	@Column({ nullable: true })
	taxType: string;

	@ApiPropertyOptional({ type: String, enum: InvoiceTypeEnum })
	@IsEnum(InvoiceTypeEnum)
	@IsOptional()
	@Column({ nullable: true })
	invoiceType?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	sentTo?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	organizationId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	clientId?: string;

	@ApiPropertyOptional({ type: Organization })
	@ManyToOne((type) => Organization)
	@JoinColumn()
	fromOrganization?: Organization;

	@ApiPropertyOptional({ type: OrganizationClients })
	@ManyToOne((type) => OrganizationClients)
	@JoinColumn()
	toClient?: OrganizationClients;

	@ApiPropertyOptional({ type: InvoiceItem, isArray: true })
	@OneToMany((type) => InvoiceItem, (invoiceItem) => invoiceItem.invoice, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceItems?: InvoiceItem[];

	@ApiPropertyOptional({ type: Payment, isArray: true })
	@OneToMany((type) => Payment, (payment) => payment.invoice, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: Payment[];
}
