import { MicrosoftAuthGuard } from './microsoft-auth-guard';
import { KeycloakAuthGuard } from './keycloak-auth-guard';

export const AuthGuards = [MicrosoftAuthGuard, KeycloakAuthGuard];
