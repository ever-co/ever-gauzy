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
import { FeatureModule } from '../feature/feature.module';
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
 *
 * `FeatureModule` is imported for the gate rather than for a resolver: the GraphQL view is gated by
 * `FeatureFlagGuard`, and a guard is a provider of whichever module declares the handler it protects —
 * so this module is what has to reach the feature service the guard resolves through. Without it the
 * API boot fails on an unresolved dependency, which no static check sees.
 *
 * It is imported **plainly rather than through `forwardRef`**, and that is a statement about the file
 * graph rather than a preference. `forwardRef` is what `TenantSettingModule` needs because the feature
 * subscriber reaches the file-storage barrel, that barrel reaches `FileStorageModule`, and that module
 * imports the settings module — so its edge back to `FeatureModule` is evaluated in the middle of a
 * cycle, where one of the two module classes is not yet assigned. Nothing the feature side loads
 * reaches this one: `FeatureModule` imports the two `forFeature` registrations,
 * `forwardRef(() => RolePermissionModule)` and `CqrsModule`, and walking the relative imports out of
 * `feature.module.ts`, `feature-toggle.resolver.ts` and `feature.subscriber.ts` arrives at no file of
 * this domain — so the deferred reference would state a cycle that does not exist.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Invoice]),
		MikroOrmModule.forFeature([Invoice]),
		CqrsModule,
		EmailSendModule,
		RolePermissionModule,
		OrganizationModule,
		FeatureModule,
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
