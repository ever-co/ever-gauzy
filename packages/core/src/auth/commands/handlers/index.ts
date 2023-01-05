import { AuthLoginHandler } from './auth.login.handler';
import { AuthRegisterHandler } from './auth.register.handler';
import { SendAuthCodeHandler } from './send-auth-code.handler';
import { VerifyAuthCodeHandler } from './verify-auth-code.handler';

export const CommandHandlers = [
    AuthLoginHandler,
    AuthRegisterHandler,
    SendAuthCodeHandler,
    VerifyAuthCodeHandler
];
