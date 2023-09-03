import { AuthLoginHandler } from './auth.login.handler';
import { AuthRegisterHandler } from './auth.register.handler';
import { SendWorkspaceSigninCodeHandler } from './send-workspace-signin-code.handler';
import { VerifyAuthCodeHandler } from './verify-auth-code.handler';

export const CommandHandlers = [
    AuthLoginHandler,
    AuthRegisterHandler,
    SendWorkspaceSigninCodeHandler,
    VerifyAuthCodeHandler
];
