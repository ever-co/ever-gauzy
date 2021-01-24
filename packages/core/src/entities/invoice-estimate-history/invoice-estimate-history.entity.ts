import { IInvoice, IInvoiceEstimateHistory } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { Invoice, TenantOrganizationBaseEntity, User } from '../internal';

@Entity('invoice_estimate_history')
export class InvoiceEstimateHistory
	extends TenantOrganizationBaseEntity
	implements IInvoiceEstimateHistory {
	constructor(input?: DeepPartial<InvoiceEstimateHistory>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	action: string;

	@ApiProperty({ type: String })
	@IsString()
	userId: string;

	@ApiProperty({ type: User })
	@ManyToOne(() => User)
	@JoinColumn()
	user: User;

	@ApiProperty({ type: String })
	@IsString()
	invoiceId: string;

	@ApiProperty({ type: Invoice })
	@ManyToOne(() => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice: IInvoice;
}
