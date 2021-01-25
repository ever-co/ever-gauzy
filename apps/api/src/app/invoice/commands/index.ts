import { InvoiceCreateHandler } from './handlers/invoice.create.handler';
import { InvoiceDeleteHandler } from './handlers/invoice.delete.handler';
import { InvoiceGenerateLinkHandler } from './handlers/invoice.generate.link.handler';
import { InvoiceSendEmailHandler } from './handlers/invoice.send.email.handler';
import { InvoiceUpdateHandler } from './handlers/invoice.update.handler';

export { InvoiceCreateCommand } from './invoice.create.command';
export { InvoiceDeleteCommand } from './invoice.delete.command';
export { InvoiceSendEmailCommand } from './invoice.send.email.command';
export { InvoiceUpdateCommand } from './invoice.update.command';
export { InvoiceGenerateLinkCommand } from './invoice.generate.link.command';

export const CommandHandlers = [
	InvoiceCreateHandler,
	InvoiceUpdateHandler,
	InvoiceSendEmailHandler,
	InvoiceDeleteHandler,
	InvoiceGenerateLinkHandler
];
