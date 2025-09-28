import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceAmount } from './invoice-amount.entity';
import { MikroOrmInvoiceAmountRepository } from './repository/mikro-orm-invoice-amount.repository';
import { TypeOrmInvoiceAmountRepository } from './repository/type-orm-invoice-amount.repository';

@Module({
	imports: [TypeOrmModule.forFeature([InvoiceAmount]), MikroOrmModule.forFeature([InvoiceAmount])],
	providers: [MikroOrmInvoiceAmountRepository, TypeOrmInvoiceAmountRepository],
	exports: [MikroOrmInvoiceAmountRepository, TypeOrmInvoiceAmountRepository]
})
export class InvoiceAmountModule {}
