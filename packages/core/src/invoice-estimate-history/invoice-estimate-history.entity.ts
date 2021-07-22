import { IInvoice, IInvoiceEstimateHistory } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Entity, Column, JoinColumn, ManyToOne, Index, RelationId } from 'typeorm';
import {
	Invoice,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('invoice_estimate_history')
export class InvoiceEstimateHistory
	extends TenantOrganizationBaseEntity
	implements IInvoiceEstimateHistory {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	action: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => User })
	@ManyToOne(() => User, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	user: User;

	@ApiProperty({ type: () => String })
	@RelationId((it: InvoiceEstimateHistory) => it.user)
	@IsString()
	@Index()
	@Column()
	userId: string;

	@ApiProperty({ type: () => Invoice })
	@ManyToOne(() => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'CASCADE'
	})
	invoice: IInvoice;

	@ApiProperty({ type: () => String })
	@RelationId((it: InvoiceEstimateHistory) => it.invoice)
	@IsString()
	@Index()
	@Column()
	invoiceId: string;
}
