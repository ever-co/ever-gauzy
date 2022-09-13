import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryHandlers } from './queries/handlers';
import { Invoice } from './../../core/entities/internal';
import { PublicInvoiceController } from './public-invoice.controller';
import { PublicInvoiceService } from './public-invoice.service';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([ Invoice ]),
	],
	controllers: [
		PublicInvoiceController
	],
	providers: [
		PublicInvoiceService,
		...QueryHandlers
	],
	exports: []
})
export class PublicInvoiceModule {}