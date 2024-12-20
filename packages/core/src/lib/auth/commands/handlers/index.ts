import { AuthLoginHandler } from './auth.login.handler';
import { AuthRegisterHandler } from './auth.register.handler';
import { WorkspaceSigninSendCodeCommandHandler } from './workspace-signin-send-code.handler';
import { WorkspaceSigninVerifyTokenHandler } from './workspace-signin-verify-token.handler';

export const CommandHandlers = [
    AuthLoginHandler,
    AuthRegisterHandler,
    WorkspaceSigninSendCodeCommandHandler,
    WorkspaceSigninVerifyTokenHandler
];
