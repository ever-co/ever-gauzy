import { CreateSoundshotCommandHandler } from './create-soundshot-command.handler';
import { DeleteSoundshotCommandHandler } from './delete-soundshot-command.handler';
import { RecoverSoundshotCommandHandler } from './recover-soundshot-command.handler';

export const commandHandlers = [
	CreateSoundshotCommandHandler,
	DeleteSoundshotCommandHandler,
	RecoverSoundshotCommandHandler
];
