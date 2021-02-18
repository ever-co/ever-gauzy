import {
	InvoiceCreateHandler,
	InvoiceDeleteHandler,
	InvoiceGenerateLinkHandler,
	InvoiceGeneratePdfHandler,
	InvoiceSendEmailHandler,
	InvoiceUpdateHandler
} from './handlers';

export * from './invoice.create.command';
export * from './invoice.delete.command';
export * from './invoice.send.email.command';
export * from './invoice.update.command';
export * from './invoice.generate.link.command';
export * from './invoice.generate.pdf.command';

export const CommandHandlers = [
	InvoiceCreateHandler,
	InvoiceUpdateHandler,
	InvoiceSendEmailHandler,
	InvoiceDeleteHandler,
	InvoiceGenerateLinkHandler,
	InvoiceGeneratePdfHandler
];
