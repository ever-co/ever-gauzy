import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdjustmentModule, EventOutboxModule, FeatureModule, IdempotencyModule, RolePermissionModule } from '@gauzy/core';
import { resolvers } from './graphql/resolvers';
import { SubscriptionPlan } from './subscription-plan/subscription-plan.entity';
import { SubscriptionPlanController } from './subscription-plan/subscription-plan.controller';
import { SubscriptionPlanService } from './subscription-plan/subscription-plan.service';
import { MikroOrmSubscriptionPlanRepository } from './subscription-plan/repository/mikro-orm-subscription-plan.repository';
import { TypeOrmSubscriptionPlanRepository } from './subscription-plan/repository/type-orm-subscription-plan.repository';
import { Subscription } from './subscription/subscription.entity';
import { SubscriptionController } from './subscription/subscription.controller';
import { SubscriptionService } from './subscription/subscription.service';
import { MikroOrmSubscriptionRepository } from './subscription/repository/mikro-orm-subscription.repository';
import { TypeOrmSubscriptionRepository } from './subscription/repository/type-orm-subscription.repository';
import { SubscriptionItem } from './subscription-item/subscription-item.entity';
import { SubscriptionItemController } from './subscription-item/subscription-item.controller';
import { SubscriptionItemService } from './subscription-item/subscription-item.service';
import { MikroOrmSubscriptionItemRepository } from './subscription-item/repository/mikro-orm-subscription-item.repository';
import { TypeOrmSubscriptionItemRepository } from './subscription-item/repository/type-orm-subscription-item.repository';
import { SubscriptionBilling } from './subscription-billing/subscription-billing.entity';
import { SubscriptionBillingController } from './subscription-billing/subscription-billing.controller';
import { SubscriptionBillingService } from './subscription-billing/subscription-billing.service';
import { MikroOrmSubscriptionBillingRepository } from './subscription-billing/repository/mikro-orm-subscription-billing.repository';
import { TypeOrmSubscriptionBillingRepository } from './subscription-billing/repository/type-orm-subscription-billing.repository';

/** Every entity this plugin owns, in dependency order, as one array. */
export const ALL_SUBSCRIPTION_ENTITIES = [SubscriptionPlan, Subscription, SubscriptionItem, SubscriptionBilling];

/**
 * The subscription domain's Nest wiring.
 *
 * Both ORMs are registered for every entity because the platform selects its ORM at boot, and the
 * paired repositories are providers rather than being constructed by the services — that pairing is
 * what lets the same service run on either.
 *
 * Four core modules are imported, and each one is imported for a reason that is the kernel's rather
 * than this domain's:
 *
 * - `RolePermissionModule` and `FeatureModule` because the controllers carry `PermissionGuard` and
 *   `FeatureFlagGuard`, and a guard is resolved by the module that declares the handler it protects;
 * - `IdempotencyModule` because a billing cycle is a retryable request and the platform owns the
 *   store that makes it safe to retry;
 * - `AdjustmentModule` because a plan discount and a proration credit are rows in the platform's
 *   money-adjustment ledger, not amounts silently folded into a price;
 * - `EventOutboxModule` because every `subscription.*` event commits with the state change it
 *   describes.
 *
 * Four capabilities of *other* domains are deliberately not imported: the catalogue, pricing, the
 * order path and the stored instruments are reached through optional injection tokens instead, so
 * this package depends on their public surface rather than on their modules. A tenant that has not
 * registered one of them is refused with a named error rather than guessed at.
 */
@Module({
	controllers: [
		SubscriptionPlanController,
		SubscriptionController,
		SubscriptionItemController,
		SubscriptionBillingController
	],
	imports: [
		TypeOrmModule.forFeature(ALL_SUBSCRIPTION_ENTITIES),
		MikroOrmModule.forFeature(ALL_SUBSCRIPTION_ENTITIES),
		FeatureModule,
		RolePermissionModule,
		IdempotencyModule,
		AdjustmentModule,
		EventOutboxModule
	],
	providers: [
		SubscriptionPlanService,
		SubscriptionService,
		SubscriptionItemService,
		SubscriptionBillingService,
		TypeOrmSubscriptionPlanRepository,
		MikroOrmSubscriptionPlanRepository,
		TypeOrmSubscriptionRepository,
		MikroOrmSubscriptionRepository,
		TypeOrmSubscriptionItemRepository,
		MikroOrmSubscriptionItemRepository,
		TypeOrmSubscriptionBillingRepository,
		MikroOrmSubscriptionBillingRepository,
		// The GraphQL resolvers are providers here because they inject the same services the REST
		// controllers do; the plugin hands the composition pass the same classes through
		// `extensions.resolvers`, so there is one implementation per rule rather than one per surface.
		...resolvers
	],
	// Exporting the services is what makes the resolvers resolvable: the resolver host declares them
	// as its own providers and imports this module, so a service this module keeps to itself is a
	// service no resolver can inject.
	exports: [SubscriptionPlanService, SubscriptionService, SubscriptionItemService, SubscriptionBillingService]
})
export class SubscriptionModule {}
