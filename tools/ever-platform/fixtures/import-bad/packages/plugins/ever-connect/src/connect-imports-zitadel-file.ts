// Known-bad: the connection reaching into the sign-in plugin's files and its web part (its entry point is allowed).
import { EverIdAccountsPort } from '@gauzy/plugin-auth-zitadel/src/lib/ports/ever-id-accounts.port';
import { EverIdLoginButton } from '@gauzy/plugin-auth-zitadel-ui';
import { EVER_ID_ACCOUNTS } from '@gauzy/plugin-auth-zitadel';
export { EverIdAccountsPort, EverIdLoginButton, EVER_ID_ACCOUNTS };
