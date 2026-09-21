import { Global, Module } from '@nestjs/common';
import { PaymentInstrumentEligibilityService, PaymentInstrumentModule } from '@gauzy/core';
import { CART_STOCK_AVAILABILITY, CART_TAX_CALCULATION } from '@gauzy/plugin-cart';
import { CatalogItemService, CatalogModule, ProductVariantSaleService } from '@gauzy/plugin-catalog';
import {
	FulfillmentModule,
	ReturnShipmentService,
	WarehouseFulfillmentService
} from '@gauzy/plugin-fulfillment';
import { InventoryModule, StockAvailabilityService, StockLedgerService } from '@gauzy/plugin-inventory';
import {
	OrderLineFulfillmentService,
	OrderLineService,
	OrderModule,
	SubscriptionOrderService
} from '@gauzy/plugin-order';
import { PricingModule, RecurringPriceService } from '@gauzy/plugin-pricing';
import { PAYMENT_ORDER_LINE_REFUND, PaymentModule, ReturnRefundService } from '@gauzy/plugin-payment';
import {
	PURCHASING_APPROVAL,
	PURCHASING_INVENTORY,
	PurchaseApprovalService,
	PurchasingModule
} from '@gauzy/plugin-purchasing';
import { ENTITLEMENT_CATALOG_PORT } from '@gauzy/plugin-entitlement';
import {
	RETURNS_ORDER_FULFILLMENT,
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
import { TaxModule, TaxRateService } from '@gauzy/plugin-tax';
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
		// The order package owns the line's refund register, and its module already exports the service
		// that moves it. It also answers how much of a line has been fulfilled, which is what a return
		// is measured against.
		OrderModule,
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
		TaxModule
	],
	providers: [
		// The payment package reports what a succeeded refund paid back per line; the order package is
		// the only writer of `order_line.refundedQuantity` / `refundedAmount`.
		{ provide: PAYMENT_ORDER_LINE_REFUND, useExisting: OrderLineService },
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
		{ provide: RETURNS_REFUND_GATEWAY, useExisting: ReturnRefundService }
	],
	exports: [
		PAYMENT_ORDER_LINE_REFUND,
		RETURNS_ORDER_FULFILLMENT,
		SUBSCRIPTION_PRICING,
		SUBSCRIPTION_CATALOG,
		ENTITLEMENT_CATALOG_PORT,
		PURCHASING_APPROVAL,
		SUBSCRIPTION_INSTRUMENTS,
		SUBSCRIPTION_ORDER_GATEWAY,
		CART_STOCK_AVAILABILITY,
		CART_TAX_CALCULATION,
		WAREHOUSE_STOCK_LEDGER,
		RETURNS_STOCK_LEDGER,
		PURCHASING_INVENTORY,
		WAREHOUSE_FULFILLMENT,
		RETURNS_SHIPMENT_GATEWAY,
		RETURNS_REFUND_GATEWAY
	]
})
export class PluginCompositionModule {}
