import { CustomSmtpCreateHandler } from './handlers/custom-smtp.create.handler';
import { CustomSmtpUpdateHandler } from './handlers/custom-smtp.update.handler';

export { CustomSmtpCreateCommand } from './custom-smtp.create.command';
export { CustomSmtpUpdateCommand } from './custom-smtp.update.command';

export const CommandHandlers = [
	CustomSmtpCreateHandler,
	CustomSmtpUpdateHandler
];
