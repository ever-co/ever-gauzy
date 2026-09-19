import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailSendModule } from './../email-send/email-send.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Payment } from './payment.entity';
import { PaymentController } from './payment.controller';
import { PaymentResolver } from './payment.resolver';
import { PaymentService } from './payment.service';
import { PaymentMapService } from './payment.map.service';
import { TypeOrmPaymentRepository } from './repository/type-orm-payment.repository';
import { MikroOrmPaymentRepository } from './repository/mikro-orm-payment.repository';

/**
 * The money ledger.
 *
 * `PaymentResolver` is declared here, beside the service it calls, because a resolver can only inject
 * services its own module can reach and this module is what reaches them. The GraphQL host discovers
 * it by scanning this module rather than by listing the class itself, which is why the resolver being
 * a provider here is the whole of the registration.
 *
 * **Nothing had to be re-exported for the resolver's dependencies, and that is a property of these
 * routes rather than an omission.** Every write this resource serves reaches a `PaymentService` method
 * — the create, the edit that is the platform's own upsert, the two removals and the receipt — and no
 * one of them dispatches a command, so the resolver injects that one service and nothing else. It is
 * already exported, so a module that imports this one receives it. The REST controller beside the
 * resolver resolves the same service from this module's own imports, which is why the export list
 * needed no change to gain a GraphQL view of the same resource.
 *
 * `FeatureModule` is not imported, although the resolver's guard chain carries the feature gate: the
 * module is global, so the feature service `FeatureFlagGuard` resolves through is available wherever a
 * guard runs. `RolePermissionModule` is imported for the two guards the resolver shares with the
 * controller — a guard is a provider of whichever module declares the handler it protects — and it was
 * already here for the controller.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Payment]),
		MikroOrmModule.forFeature([Payment]),
		RolePermissionModule,
		EmailSendModule
	],
	controllers: [PaymentController],
	providers: [
		PaymentService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		PaymentResolver,
		PaymentMapService,
		TypeOrmPaymentRepository,
		MikroOrmPaymentRepository
	],
	exports: [PaymentService, PaymentMapService, TypeOrmPaymentRepository, MikroOrmPaymentRepository]
})
export class PaymentModule {}