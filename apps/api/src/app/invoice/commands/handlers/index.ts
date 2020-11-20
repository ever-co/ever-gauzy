import { InvoiceCreateHandler } from './invoice.create.handler';
import { InvoiceDeleteHandler } from './invoice.delete.handler';
import { InvoiceSendEmailHandler } from './invoice.send.email.handler';
import { InvoiceUpdateHandler } from './invoice.update.handler';

export const CommandHandlers = [
	InvoiceCreateHandler,
	InvoiceUpdateHandler,
	InvoiceSendEmailHandler,
	InvoiceDeleteHandler
];
