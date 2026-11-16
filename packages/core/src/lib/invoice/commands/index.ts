import {
	InvoiceCreateHandler,
	InvoiceDeleteHandler,
	InvoiceGenerateLinkHandler,
	InvoiceGeneratePdfHandler,
	InvoicePaymentGeneratePdfHandler,
	InvoiceSendEmailHandler,
	InvoiceUpdateHandler,
	InvoiceUpdateWithItemsHandler
} from './handlers';

export * from './invoice.create.command';
export * from './invoice.delete.command';
export * from './invoice.send.email.command';
export * from './invoice.update.command';
export * from './invoice.update-with-items.command';
export * from './invoice.generate.link.command';
export * from './invoice.generate.pdf.command';
export * from './invoice-payment.generate.pdf.command';

export const CommandHandlers = [
	InvoiceCreateHandler,
	InvoiceUpdateHandler,
	InvoiceUpdateWithItemsHandler,
	InvoiceSendEmailHandler,
	InvoiceDeleteHandler,
	InvoiceGenerateLinkHandler,
	InvoiceGeneratePdfHandler,
	InvoicePaymentGeneratePdfHandler
];
