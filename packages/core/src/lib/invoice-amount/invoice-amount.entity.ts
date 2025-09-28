import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { MultiORMEntity, MultiORMColumn, MultiORMManyToOne, ColumnIndex } from '../core/decorators/entity';
import { CurrenciesEnum, ID, IInvoice, IInvoiceAmount } from '@gauzy/contracts';
import { MikroOrmInvoiceAmountRepository } from './repository/mikro-orm-invoice-amount.repository';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { TenantOrganizationBaseEntity, Invoice } from '../core/entities/internal';
import { ColumnNumericTransformerPipe } from '../shared/pipes/column-numeric-transformer.pipe';

@MultiORMEntity('invoice_amount', {
	mikroOrmRepository: () => MikroOrmInvoiceAmountRepository
})
export class InvoiceAmount extends TenantOrganizationBaseEntity implements IInvoiceAmount {
	[EntityRepositoryType]?: MikroOrmInvoiceAmountRepository;

	@ApiPropertyOptional({ type: () => Number })
	@IsNumber()
	@IsOptional()
	@MultiORMColumn({
		nullable: true,
		type: 'numeric',
		transformer: new ColumnNumericTransformerPipe()
	})
	totalValue?: number;

	@ApiPropertyOptional({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	currency?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne - Invoice
    |--------------------------------------------------------------------------
    */

	@ApiPropertyOptional({ type: () => Invoice })
	@IsOptional()
	@MultiORMManyToOne(() => Invoice, (invoice) => invoice.amounts, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	invoice?: IInvoice;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: InvoiceAmount) => it.invoice)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invoiceId?: ID;
}
