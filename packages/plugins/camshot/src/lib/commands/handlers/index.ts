import { CreateCamshotCommandHandler } from './create-camshot-command.handler';
import { DeleteCamshotCommandHandler } from './delete-camshot-command.handler';
import { RecoverCamshotCommandHandler } from './recover-camshot-command.handler';

export const commandHandlers = [CreateCamshotCommandHandler, DeleteCamshotCommandHandler, RecoverCamshotCommandHandler];
