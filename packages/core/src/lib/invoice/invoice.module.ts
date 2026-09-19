import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceController } from './invoice.controller';
import { InvoiceResolver } from './invoice.resolver';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';
import { CommandHandlers } from './commands';
import { EmailSendModule } from '../email-send/email-send.module';
import { EstimateEmailModule } from '../estimate-email/estimate-email.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationModule } from './../organization/organization.module';
import { PdfmakerService } from './pdfmaker.service';
import { TypeOrmInvoiceRepository } from './repository/type-orm-invoice.repository';
import { MikroOrmInvoiceRepository } from './repository/mikro-orm-invoice.repository';

/**
 * The finance document.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's two
 * dependencies resolvable from the module the Apollo configuration names: a resolver is a provider of
 * whichever module hosts the handler, so a module that imports this one receives `InvoiceService` and
 * the command bus only if this module hands them on. The REST controller beside the resolver resolves
 * both from this module's own imports — the service is this module's own provider, the bus its own
 * `CqrsModule` import — which is why nothing needed re-exporting until the GraphQL view of the same
 * resource existed.
 */
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
	providers: [
		InvoiceService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		InvoiceResolver,
		PdfmakerService,
		TypeOrmInvoiceRepository,
		MikroOrmInvoiceRepository,
		...CommandHandlers
	],
	exports: [InvoiceService, PdfmakerService, TypeOrmInvoiceRepository, MikroOrmInvoiceRepository, CqrsModule]
})
export class InvoiceModule {}
