import { Module } from '@nestjs/common';
import { InvoiceModule, RequestApprovalModule } from '@gauzy/core';
import { OrderApprovalAdapter } from './order-approval/order-approval.adapter';
import { OrderInvoicingAdapter } from './order-invoicing/order-invoicing.adapter';

/**
 * The order package's adapters onto the platform's own documents.
 *
 * An order is invoiced and quoted through the core finance document, and a buyer's order is held for a
 * staff member's approval through the core approval machinery. The order's domain services ask for those
 * capabilities through ports they declare — `ORDER_INVOICING` and `ORDER_APPROVAL` in `order.types.ts` —
 * and the classes that answer the ports live in this package beside the domain they serve, exactly as the
 * purchasing package's approval facade does.
 *
 * **It is a module of its own, deliberately not imported by `OrderModule`.** The order module is hosted by
 * the worker process too (`apps/worker/src/plugins.ts`), for its two sweeps, and the worker builds its own
 * module graph without the e-mail, PDF and translation providers the finance module depends on. Importing
 * the finance module from the order module would therefore stop the worker booting. The installation that
 * serves the routes imports this module and binds the ports to the adapters in
 * `apps/api/src/plugin-composition.ts`; a process that does not leaves the ports unbound, and every verb
 * that needs one answers `ORDER_INVOICING_UNAVAILABLE` or `ORDER_APPROVAL_UNAVAILABLE` before writing
 * anything.
 */
@Module({
	imports: [InvoiceModule, RequestApprovalModule],
	providers: [OrderInvoicingAdapter, OrderApprovalAdapter],
	exports: [OrderInvoicingAdapter, OrderApprovalAdapter]
})
export class OrderPlatformAdaptersModule {}
