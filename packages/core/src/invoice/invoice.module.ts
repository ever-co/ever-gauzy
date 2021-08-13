import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';
import { EmailService, EmailModule } from '../email';
import { EstimateEmailModule } from '../estimate-email/estimate-email.module';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands';
import { PdfmakerService } from './pdfmaker.service';
import { OrganizationModule } from './../organization/organization.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/invoices', module: InvoiceModule }]),
		TypeOrmModule.forFeature([Invoice]),
		EmailModule,
		EstimateEmailModule,
		TenantModule,
		UserModule,
		OrganizationModule,
		CqrsModule
	],
	controllers: [InvoiceController],
	providers: [
		InvoiceService,
		PdfmakerService,
		EmailService,
		...CommandHandlers
	],
	exports: [
		InvoiceService,
		PdfmakerService
	]
})
export class InvoiceModule {}
