import { IInvoiceEstimateHistory } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../user/user.entity';
import { Invoice } from '../invoice/invoice.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('invoice_estimate_history')
export class InvoiceEstimateHistory extends TenantOrganizationBase
	implements IInvoiceEstimateHistory {
	@ApiProperty({ type: String })
	@IsString()
	@Column()
	action: string;

	@ApiProperty({ type: String })
	@IsString()
	userId: string;

	@ApiProperty({ type: User })
	@ManyToOne((type) => User)
	@JoinColumn()
	user: User;

	@ApiProperty({ type: String })
	@IsString()
	invoiceId: string;

	@ApiProperty({ type: Invoice })
	@ManyToOne((type) => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice: Invoice;
}
