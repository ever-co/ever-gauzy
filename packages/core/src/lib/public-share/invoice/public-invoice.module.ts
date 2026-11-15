import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { EstimateEmail, Invoice } from './../../core/entities/internal';
import { PublicInvoiceController } from './public-invoice.controller';
import { PublicInvoiceService } from './public-invoice.service';
import { PublicInvoiceResolver } from './public-invoice.resolver';
import { InvoiceModule } from '../../invoice/invoice.module';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Invoice, EstimateEmail]),
		MikroOrmModule.forFeature([Invoice, EstimateEmail]),
		// The PDF of an invoice, downloaded through its share link
		InvoiceModule
	],
	controllers: [PublicInvoiceController],
	providers: [PublicInvoiceService, PublicInvoiceResolver, ...QueryHandlers, ...CommandHandlers]
})
export class PublicInvoiceModule {}
