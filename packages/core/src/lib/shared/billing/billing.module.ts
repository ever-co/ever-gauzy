import { Module } from '@nestjs/common';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TenantModule } from '../../tenant/tenant.module';
import { UserModule } from '../../user/user.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeSubscriptionService } from './stripe-subscription.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * In-product billing pages, plus the hand-off to Stripe's customer portal.
 *
 * Always registered. Every route inside answers 404 unless STRIPE_SECRET_KEY is set, so a
 * self-hosted install carries the module but exposes no billing surface — cheaper and less
 * error-prone than conditionally wiring a module at boot.
 */
@Module({
	imports: [RolePermissionModule, TenantModule, UserModule],
	controllers: [BillingController, StripeWebhookController],
	providers: [BillingService, StripeSubscriptionService],
	exports: [BillingService, StripeSubscriptionService]
})
export class BillingModule {}
