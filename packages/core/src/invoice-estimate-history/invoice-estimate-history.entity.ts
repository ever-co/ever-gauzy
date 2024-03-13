import { IInvoice, IInvoiceEstimateHistory } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
	JoinColumn,
	RelationId,
} from 'typeorm';
import {
	Invoice,
	TenantOrganizationBaseEntity,
	User,
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { ColumnIndex } from './../core/decorators/entity/index.decorator';
import { MikroOrmInvoiceEstimateHistoryRepository } from './repository/mikro-orm-invoice-estimate-history.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('invoice_estimate_history', { mikroOrmRepository: () => MikroOrmInvoiceEstimateHistoryRepository })
export class InvoiceEstimateHistory extends TenantOrganizationBaseEntity implements IInvoiceEstimateHistory {

	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	action: string;

	@IsOptional()
	@ApiProperty({ type: () => String, required: false })
	@IsString()
	@MultiORMColumn({ nullable: true })
	title?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => User })
	@MultiORMManyToOne(() => User, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	user: User;

	@ApiProperty({ type: () => String })
	@RelationId((it: InvoiceEstimateHistory) => it.user)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId: string;

	@ApiProperty({ type: () => Invoice })
	@MultiORMManyToOne(() => Invoice, (invoice) => invoice.invoiceItems, {
		onDelete: 'CASCADE',
	})
	invoice: IInvoice;

	@ApiProperty({ type: () => String })
	@RelationId((it: InvoiceEstimateHistory) => it.invoice)
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	invoiceId: string;
}
