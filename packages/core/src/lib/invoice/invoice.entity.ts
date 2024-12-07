import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	JoinColumn,
	Unique,
	RelationId,
	JoinTable
} from 'typeorm';
import {
	IsString,
	IsNumber,
	IsBoolean,
	IsDate,
	IsOptional,
	IsEnum
} from 'class-validator';
import {
	IInvoice,
	CurrenciesEnum,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum,
	IInvoiceEstimateHistory,
	IPayment,
	IInvoiceItem,
	IOrganizationContact,
	IOrganization,
	ITag
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import {
	InvoiceEstimateHistory,
	InvoiceItem,
	Organization,
	OrganizationContact,
	Payment,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmInvoiceRepository } from './repository/mikro-orm-invoice.repository';

@MultiORMEntity('invoice', { mikroOrmRepository: () => MikroOrmInvoiceRepository })
@Unique(['invoiceNumber'])
export class Invoice extends TenantOrganizationBaseEntity implements IInvoice {

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ nullable: true })
	invoiceDate: Date;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		nullable: true,
		transformer: new ColumnNumericTransformerPipe(),
		...(isMySQL() ? { type: 'bigint' } : { type: 'numeric' })
	})
	invoiceNumber: number;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ nullable: true })
	dueDate: Date;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@MultiORMColumn()
	currency: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	discountValue: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true })
	paid: boolean;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	tax: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	tax2: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn()
	terms?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	totalValue?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn()
	status?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true })
	isEstimate?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true })
	isAccepted?: boolean;

	@ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum })
	@IsEnum(DiscountTaxTypeEnum)
	@MultiORMColumn({ nullable: true })
	discountType: DiscountTaxTypeEnum;

	@ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum })
	@IsEnum(DiscountTaxTypeEnum)
	@MultiORMColumn({ nullable: true })
	taxType: DiscountTaxTypeEnum;

	@ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum })
	@IsEnum(DiscountTaxTypeEnum)
	@MultiORMColumn({ nullable: true })
	tax2Type: DiscountTaxTypeEnum;

	@ApiPropertyOptional({ type: () => String, enum: InvoiceTypeEnum })
	@IsEnum(InvoiceTypeEnum)
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	invoiceType?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	sentTo?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	organizationContactId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	internalNote?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	alreadyPaid?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	amountDue?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn({ type: Boolean, nullable: true })
	hasRemainingAmountInvoiced?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		...(isMySQL() ? { type: "text" } : {})
	})
	token?: string;


	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	// From Organization
	@ApiPropertyOptional({ type: () => () => Organization })
	@MultiORMManyToOne(() => Organization)
	@JoinColumn()
	fromOrganization?: IOrganization;

	@ApiProperty({ type: () => String })
	@RelationId((it: Invoice) => it.fromOrganization)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	fromOrganizationId?: string;

	// To Contact
	@ApiPropertyOptional({ type: () => () => OrganizationContact })
	@MultiORMManyToOne(() => OrganizationContact, (contact) => contact.invoices, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	toContact?: IOrganizationContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: Invoice) => it.toContact)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	toContactId?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	// Invoice Estimate Items
	@ApiPropertyOptional({ type: () => InvoiceItem, isArray: true })
	@MultiORMOneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.invoice, {
		cascade: true
	})
	@JoinColumn()
	invoiceItems?: IInvoiceItem[];

	// Invoice Estimate Payments
	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@MultiORMOneToMany(() => Payment, (payment) => payment.invoice)
	@JoinColumn()
	payments?: IPayment[];

	// Invoice Estimate History
	@ApiPropertyOptional({ type: () => InvoiceEstimateHistory, isArray: true })
	@MultiORMOneToMany(() => InvoiceEstimateHistory, (invoiceEstimateHistory) => invoiceEstimateHistory.invoice, {
		cascade: true
	})
	@JoinColumn()
	historyRecords?: IInvoiceEstimateHistory[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Tag })
	@MultiORMManyToMany(() => Tag, (tag) => tag.invoices, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_invoice',
		joinColumn: 'invoiceId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_invoice'
	})
	tags?: ITag[];
}
