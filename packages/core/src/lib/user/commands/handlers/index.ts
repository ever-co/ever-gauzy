import { UserCreateHandler } from './user.create.handler';
import { UserDeleteHandler } from './user.delete.handler';

export const CommandHandlers = [
    UserCreateHandler,
    UserDeleteHandler
];
