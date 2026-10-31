import { Global, Module } from '@nestjs/common';
import { PaymentInstrumentEligibilityService, PaymentInstrumentModule } from '@gauzy/core';
import {
	CART_PRICE_RESOLUTION,
	CART_PROMOTION_EVALUATION,
	CART_SHIPPING_RATE,
	CART_STOCK_AVAILABILITY,
	CART_TAX_CALCULATION,
	CART_TAX_CATEGORY
} from '@gauzy/plugin-cart';
import { CatalogItemService, CatalogModule, ProductVariantSaleService } from '@gauzy/plugin-catalog';
import {
	FulfillmentModule,
	ReturnShipmentService,
	ShippingOptionService,
	WarehouseFulfillmentService
} from '@gauzy/plugin-fulfillment';
import { InventoryModule, StockAvailabilityService, StockLedgerService } from '@gauzy/plugin-inventory';
import {
	ORDER_APPROVAL,
	ORDER_CHECKOUT_PAYMENTS,
	ORDER_INVOICING,
	ORDER_PROMOTION_USAGE,
	OrderApprovalAdapter,
	OrderInvoicingAdapter,
	OrderLineFulfillmentService,
	OrderLineService,
	OrderModule,
	OrderPaymentLedgerService,
	OrderPlatformAdaptersModule,
	OrderStateReader,
	OrderTotalsService,
	SubscriptionOrderService
} from '@gauzy/plugin-order';
import { PricingModule, ProductPriceService, RecurringPriceService } from '@gauzy/plugin-pricing';
import {
	PAYMENT_ORDER_LEDGER,
	PAYMENT_ORDER_LINE_REFUND,
	PaymentModule,
	PaymentOrderLinkService,
	ReturnRefundService
} from '@gauzy/plugin-payment';
import { PromotionModule, PromotionOrderUsageAdapter, PromotionService } from '@gauzy/plugin-promotion';
import {
	PURCHASING_APPROVAL,
	PURCHASING_INVENTORY,
	PurchaseApprovalService,
	PurchasingModule
} from '@gauzy/plugin-purchasing';
import {
	ENTITLEMENT_CATALOG_PORT,
	ENTITLEMENT_ORDER_STATE_PORT,
	EntitlementModule,
	EntitlementOrderLinePolicyAdapter
} from '@gauzy/plugin-entitlement';
// Its own statement, so the order port the entitlement package answers sits beside that package (Q7-W5).
import { ORDER_LINE_ENTITLEMENT_POLICY } from '@gauzy/plugin-order';
import {
	RETURNS_ORDER_FULFILLMENT,
	RETURNS_ORDER_TOTALS,
	RETURNS_REFUND_GATEWAY,
	RETURNS_SHIPMENT_GATEWAY,
	RETURNS_STOCK_LEDGER
} from '@gauzy/plugin-returns';
import {
	SUBSCRIPTION_CATALOG,
	SUBSCRIPTION_INSTRUMENTS,
	SUBSCRIPTION_ORDER_GATEWAY,
	SUBSCRIPTION_PRICING
} from '@gauzy/plugin-subscription';
import { TaxCategoryService, TaxModule, TaxRateService } from '@gauzy/plugin-tax';
import { WAREHOUSE_FULFILLMENT, WAREHOUSE_STOCK_LEDGER } from '@gauzy/plugin-warehouse';

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
		// The catalogue owns what a product and a variant are, which is what a plan is attached to and
		// what a right is granted over.
		CatalogModule,
		// The entitlement package answers what right an order line grants, and its module exports the adapter.
		EntitlementModule,
		// The order package owns the line's refund register, and its module already exports the service
		// that moves it. It also answers how much of a line has been fulfilled, which is what a return
		// is measured against.
		OrderModule,
		// The order package's adapters onto the platform's own documents: the finance document an order is
		// invoiced and quoted with, and the approval request a buyer's order is held for. A module of its own
		// because the order module is also hosted by the worker, which builds none of the e-mail, PDF and
		// translation providers the finance module needs.
		OrderPlatformAdaptersModule,
		// The pricing package owns what a variant costs, including what it costs again every period.
		PricingModule,
		// The purchasing package owns the approval request a purchase order files, and its module
		// exports the service that answers the port.
		PurchasingModule,
		// Whether a remembered payer may still be charged is a rule over two kernel tables, so the
		// service that answers it lives in the kernel and is reached from here like any other provider.
		PaymentInstrumentModule,
		// The inventory package owns the level rows a sellability answer is derived from and the ledger
		// every physical move is written through.
		InventoryModule,
		// What a pick list is derived from, and the shipment a return or an exchange travels on, are
		// both the fulfilment package's own rows.
		FulfillmentModule,
		// The refund a return asks for is a row of the payment package's refund register.
		PaymentModule,
		// What a line is taxed at is the tax package's rate tables, its regimes and its rounding — none
		// of which the cart may read for itself.
		TaxModule,
		// What a promotion takes off a cart is the promotion package's evaluation — its rules, stacking
		// and budgets — and never an amount the cart was handed (R3-07).
		PromotionModule
	],
	providers: [
		// The payment package reports what a succeeded refund paid back per line; the order package is
		// the only writer of `order_line.refundedQuantity` / `refundedAmount`.
		{ provide: PAYMENT_ORDER_LINE_REFUND, useExisting: OrderLineService },
		// Every authorisation, capture, void and refund is a row of the order's own money ledger, which only the
		// order package writes; the payment package reports each one after its money moved (Q7-W1b). Unbound, an
		// order paid in full answered NOT_PAID for ever and could never complete.
		{ provide: PAYMENT_ORDER_LEDGER, useExisting: OrderPaymentLedgerService },
		// A buyer pays before the order exists, on a collection opened for the cart; the checkout hands that
		// collection and its payments to the order the cart became (Q7-W1b).
		{ provide: ORDER_CHECKOUT_PAYMENTS, useExisting: PaymentOrderLinkService },
		// A return cannot exceed what was sent, and only the order package knows how much that is.
		{ provide: RETURNS_ORDER_FULFILLMENT, useExisting: OrderLineFulfillmentService },
		// A billing period is priced by the pricing package, so a subscription asks it rather than
		// reading a price table of its own.
		{ provide: SUBSCRIPTION_PRICING, useExisting: RecurringPriceService },
		// Whether a variant may be sold on recurring terms, and which variant stands for a product, are
		// both settings the catalogue already records; the subscription domain asks for them rather
		// than reading another package's columns.
		{ provide: SUBSCRIPTION_CATALOG, useExisting: ProductVariantSaleService },
		// An entitlement names the product and the variant it is over, and only the catalogue can say
		// what those identifiers name.
		{ provide: ENTITLEMENT_CATALOG_PORT, useExisting: CatalogItemService },
		// An order asks, at placement, what right each of its lines grants — the variant's catalogue policy, else
		// the product's; never the line's own metadata, which the cart editor writes — so its `order.placed` event
		// carries the lines the grant path issues a right for (Q7-W5). Unbound, an order announces no lines and a
		// purchase grants nothing.
		{ provide: ORDER_LINE_ENTITLEMENT_POLICY, useExisting: EntitlementOrderLinePolicyAdapter },
		// The grant path is reorderable, so an order's settlement can be delivered before a retried placement; the
		// placement then asks the order package whether the order has settled since, and puts what it granted into
		// force itself (#11023). Unbound, those rights stay PENDING until another settlement event, as before.
		{ provide: ENTITLEMENT_ORDER_STATE_PORT, useExisting: OrderStateReader },
		// A purchase order is approved by the platform's own approval machinery: the purchasing package
		// files the request, and the core approval service owns the row.
		{ provide: PURCHASING_APPROVAL, useExisting: PurchaseApprovalService },
		// A renewal with nobody present has to ask whether the payer the subscription remembers may
		// still be charged, and the tables that answer it are the kernel's.
		{ provide: SUBSCRIPTION_INSTRUMENTS, useExisting: PaymentInstrumentEligibilityService },
		// A billing period raises the order it bills through the ordinary order path, and the package
		// that owns orders is the one that raises it: the cycle states its lines, its amount and its
		// payer, and receives an order back.
		{ provide: SUBSCRIPTION_ORDER_GATEWAY, useExisting: SubscriptionOrderService },
		// The cart asks what may be sold before it accepts a line, and the inventory package owns the
		// level rows the answer is derived from.
		{ provide: CART_STOCK_AVAILABILITY, useExisting: StockAvailabilityService },
		// A cart asks what its lines are taxed and writes the answer into the platform's own `tax_line`
		// ledger; the tax package decides what a rate is. Unbound, a cart's tax total stays zero — which
		// is the state the package shipped in, and it was a defect rather than a decision: nothing in
		// the cart ever wrote a tax line, so a buyer in a VAT jurisdiction was quoted a tax-free total,
		// and a tax-inclusive catalogue had each line's net computed as `gross - 0`, folding the tax the
		// price already contained into the subtotal without declaring it anywhere.
		{ provide: CART_TAX_CALCULATION, useExisting: TaxRateService },
		// What a promotion grants a cart is the promotion engine's answer: the cart hands it the cart and
		// the codes it carries and records what comes back. Unbound, the cart refuses to apply a promotion
		// rather than recording an amount the caller stated — which is what it did before (R3-07): a buyer
		// could name any code and any discount, and the cart re-priced from it.
		{ provide: CART_PROMOTION_EVALUATION, useExisting: PromotionService },
		// What the engine granted is also a redemption: a checkout takes the promotion's use before the order
		// is written and registers it once placed, and a cancellation gives it back (Q7-W1c). Unbound, a
		// promotion's usage limit counted nothing and could be redeemed without end.
		{ provide: ORDER_PROMOTION_USAGE, useExisting: PromotionOrderUsageAdapter },
		// What a cart line costs is the pricing package's resolution — its price lists, sale and override
		// lists, quantity bands and currency — for the cart and the line's quantity. Unbound, the cart refuses a
		// line rather than recording the price its caller stated, which is what it did before (R3-07b).
		{ provide: CART_PRICE_RESOLUTION, useExisting: ProductPriceService },
		// What a delivery choice costs is the configured shipping option's rate on the cart, and how it is taxed
		// is the option's too; the fulfilment package owns both. Unbound, the cart refuses a delivery choice
		// rather than recording the amount its caller stated, which is what it did before (R3-07c).
		{ provide: CART_SHIPPING_RATE, useExisting: ShippingOptionService },
		// What a line is taxed under is the variant's category, or the organization's default: the tax package
		// reads both. Unbound, a line carries no category (the rate resolution then applies the default), never
		// the one its caller named (R3-07c).
		{ provide: CART_TAX_CATEGORY, useExisting: TaxCategoryService },
		// The warehouse reads bin contents from the ledger and writes every physical move back through
		// it; a return restocks what came back through the same ledger, in the same instance.
		{ provide: WAREHOUSE_STOCK_LEDGER, useExisting: StockLedgerService },
		{ provide: RETURNS_STOCK_LEDGER, useExisting: StockLedgerService },
		// A goods receipt posts the units it received and then walks them into a bin: the receiving side of
		// the ledger is the same seam, and the put-away is the operation that writes the home bin a pick
		// reads. Bound to the same instance as the two above, because one ledger serves all three.
		{ provide: PURCHASING_INVENTORY, useExisting: StockLedgerService },
		// A pick list is built from what the fulfilment rows say was shipped, and a return or an
		// exchange needs an outbound shipment of its own.
		{ provide: WAREHOUSE_FULFILLMENT, useExisting: WarehouseFulfillmentService },
		{ provide: RETURNS_SHIPMENT_GATEWAY, useExisting: ReturnShipmentService },
		// A return's money is refunded by the payment package, which owns the refund register.
		{ provide: RETURNS_REFUND_GATEWAY, useExisting: ReturnRefundService },
		// A return that gives money back moves the order's ledger, so the order's materialised totals and
		// status are re-derived from it — the same single function every other domain writer calls, bound to
		// the same instance. Without this binding the port is declared, injected and called by nothing that
		// can answer it: the recompute is inert and the order's cached status goes stale in silence, which is
		// the failure the binding exists to prevent. (ADR-26's "inside the same transaction" half is unmet on
		// this path — `recompute` takes no entity manager and this side opens no transaction — and that is
		// recorded rather than hidden; what the binding buys is that the recompute happens at all.)
		{ provide: RETURNS_ORDER_TOTALS, useExisting: OrderTotalsService },
		// An order is billed and quoted with the platform's own invoice and estimate: the order package builds
		// the document from the order's computed figures, and the core invoice service writes and sends it.
		{ provide: ORDER_INVOICING, useExisting: OrderInvoicingAdapter },
		// A buyer's order is held for a staff member's approval by the platform's own approval machinery: the
		// order package files the request against the order, and the core approval service owns the row.
		{ provide: ORDER_APPROVAL, useExisting: OrderApprovalAdapter }
	],
	exports: [
		PAYMENT_ORDER_LINE_REFUND,
		RETURNS_ORDER_FULFILLMENT,
		RETURNS_ORDER_TOTALS,
		SUBSCRIPTION_PRICING,
		SUBSCRIPTION_CATALOG,
		ENTITLEMENT_CATALOG_PORT,
		ORDER_LINE_ENTITLEMENT_POLICY,
		ENTITLEMENT_ORDER_STATE_PORT,
		PURCHASING_APPROVAL,
		SUBSCRIPTION_INSTRUMENTS,
		SUBSCRIPTION_ORDER_GATEWAY,
		CART_STOCK_AVAILABILITY,
		CART_TAX_CALCULATION,
		CART_PROMOTION_EVALUATION,
		CART_PRICE_RESOLUTION,
		CART_SHIPPING_RATE,
		CART_TAX_CATEGORY,
		WAREHOUSE_STOCK_LEDGER,
		RETURNS_STOCK_LEDGER,
		PURCHASING_INVENTORY,
		WAREHOUSE_FULFILLMENT,
		RETURNS_SHIPMENT_GATEWAY,
		RETURNS_REFUND_GATEWAY,
		ORDER_INVOICING,
		ORDER_APPROVAL,
		PAYMENT_ORDER_LEDGER,
		ORDER_CHECKOUT_PAYMENTS,
		ORDER_PROMOTION_USAGE
	]
})
export class PluginCompositionModule {}
