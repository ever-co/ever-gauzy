import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';
import { CommandHandlers } from './commands';
import { EmailSendModule } from '../email-send/email-send.module';
import { EstimateEmailModule } from '../estimate-email/estimate-email.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationModule } from './../organization/organization.module';
import { PdfmakerService } from './pdfmaker.service';
import { TypeOrmInvoiceRepository } from './repository/type-orm-invoice.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Invoice]),
		MikroOrmModule.forFeature([Invoice]),
		CqrsModule,
		EmailSendModule,
		RolePermissionModule,
		OrganizationModule,
		forwardRef(() => EstimateEmailModule)
	],
	controllers: [InvoiceController],
	providers: [InvoiceService, PdfmakerService, TypeOrmInvoiceRepository, ...CommandHandlers],
	exports: [InvoiceService, PdfmakerService, TypeOrmInvoiceRepository]
})
export class InvoiceModule {}
