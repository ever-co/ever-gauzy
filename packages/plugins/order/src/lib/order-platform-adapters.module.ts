import { Module } from '@nestjs/common';
import { InvoiceModule } from '@gauzy/core';
import { OrderInvoicingAdapter } from './order-invoicing/order-invoicing.adapter';

/**
 * The order package's adapters onto the platform's own documents.
 *
 * An order is invoiced and quoted through the core finance document. The order's domain service asks
 * for that capability through a port it declares — `ORDER_INVOICING` in `order.types.ts` — and the class
 * that answers the port lives in this package beside the domain it serves, exactly as the purchasing
 * package's approval facade does.
 *
 * **It is a module of its own, deliberately not imported by `OrderModule`.** The order module is hosted by
 * the worker process too (`apps/worker/src/plugins.ts`), for its two sweeps, and the worker builds its own
 * module graph without the e-mail, PDF and translation providers the finance module depends on. Importing
 * the finance module from the order module would therefore stop the worker booting. The installation that
 * serves the routes imports this module and binds the port to the adapter in
 * `apps/api/src/plugin-composition.ts`; a process that does not leaves the port unbound, and every verb
 * that needs a document answers `ORDER_INVOICING_UNAVAILABLE` before writing anything.
 */
@Module({
	imports: [InvoiceModule],
	providers: [OrderInvoicingAdapter],
	exports: [OrderInvoicingAdapter]
})
export class OrderPlatformAdaptersModule {}
