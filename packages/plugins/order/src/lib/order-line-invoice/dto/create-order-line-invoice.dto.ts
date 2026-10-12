import { OrderLineInvoiceDTO } from './order-line-invoice.dto';

/**
 * Create line-to-invoice link request validation.
 *
 * A link is recorded by whoever writes the accounting item — the order-to-invoice bridge, or the
 * credit-note path — in the same transaction as the item, so the line's counters and the document they
 * describe can never be observed apart.
 */
export class CreateOrderLineInvoiceDTO extends OrderLineInvoiceDTO {}
