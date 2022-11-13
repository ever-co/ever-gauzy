import { AuthLoginHandler } from './auth.login.handler';
import { AuthRegisterHandler } from './auth.register.handler';
import { ConfirmInviteCodeHandler } from './confirm-invite-code.handler';
import { SendInviteCodeHandler } from './send-invite-code.handler';

export const CommandHandlers = [
    AuthRegisterHandler,
    AuthLoginHandler,
    SendInviteCodeHandler,
    ConfirmInviteCodeHandler
];
