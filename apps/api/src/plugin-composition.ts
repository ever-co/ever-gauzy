import { Global, Module } from '@nestjs/common';
import { OrderLineFulfillmentService, OrderLineService, OrderModule } from '@gauzy/plugin-order';
import { PricingModule, RecurringPriceService } from '@gauzy/plugin-pricing';
import { PAYMENT_ORDER_LINE_REFUND } from '@gauzy/plugin-payment';
import { RETURNS_ORDER_FULFILLMENT } from '@gauzy/plugin-returns';
import { SUBSCRIPTION_PRICING } from '@gauzy/plugin-subscription';

/**
 * This installation's composition point.
 *
 * A capability is delivered by one package and needed by another, and the two are installed
 * independently. The package that needs the capability declares a small port of its own and injects
 * it under an optional token; the package that offers the capability owns a service that answers it.
 * Neither package imports the other, so the two sides meet only where an installation decides to join
 * them — and this module is that decision.
 *
 * It is not a plugin. It owns no table, no migration, no route, no permission and no metadata, and
 * nothing about it is discoverable from a package. It exists so that the binding has an owner that is
 * a deployment choice rather than a package dependency: an installation that installs only one of the
 * two packages simply leaves the port unbound, the consumer reports the capability as unavailable,
 * and every package still boots on its own.
 *
 * **Why it has to be global.** A provider is resolved in the scope of the module that declares the
 * class doing the *injecting*, and a module's imports are not inherited by the modules it imports.
 * Every consumer of a port here is a provider of its own package's module — the payment package's
 * refund handler, the warehouse package's bin service, the returns package's order-return service —
 * and that module must not import the package satisfying the port, or the independence the port
 * exists to preserve is gone. A global module's exports reach every module in the application without
 * any module importing it, which is the only arrangement that joins these two sides while leaving
 * every package installable by itself.
 *
 * **How a port is bound.** Every binding below is a one-line alias: `useExisting` names the service
 * that already answers the port, so there is one instance of the capability rather than a second
 * adapter that can drift from it. The service has to be reachable from here, which is why the module
 * that exports it is in the import list. Where no service in the installation has the port's shape
 * yet, the port is deliberately absent from the provider list rather than aliased to something that
 * merely looks close: a port bound to a service it does not match is worse than a port left open,
 * because the consumer stops reporting the capability as unavailable and starts calling a method that
 * answers a different question.
 */
@Global()
@Module({
	imports: [
		// The order package owns the line's refund register, and its module already exports the service
		// that moves it. It also answers how much of a line has been fulfilled, which is what a return
		// is measured against.
		OrderModule,
		// The pricing package owns what a variant costs, including what it costs again every period.
		PricingModule
	],
	providers: [
		// The payment package reports what a succeeded refund paid back per line; the order package is
		// the only writer of `order_line.refundedQuantity` / `refundedAmount`.
		{ provide: PAYMENT_ORDER_LINE_REFUND, useExisting: OrderLineService },
		// A return cannot exceed what was sent, and only the order package knows how much that is.
		{ provide: RETURNS_ORDER_FULFILLMENT, useExisting: OrderLineFulfillmentService },
		// A billing period is priced by the pricing package, so a subscription asks it rather than
		// reading a price table of its own.
		{ provide: SUBSCRIPTION_PRICING, useExisting: RecurringPriceService }
	],
	exports: [PAYMENT_ORDER_LINE_REFUND, RETURNS_ORDER_FULFILLMENT, SUBSCRIPTION_PRICING]
})
export class PluginCompositionModule {}
