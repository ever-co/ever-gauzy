import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../core/context/request-context';

/**
 * Refuses a request authenticated by a third-party OAuth-app token (owner decision Q12, see `oauth-app-scope.ts`).
 *
 * For the actions that belong to the user's own session whatever the app's scopes and the user's role:
 *
 * - approving an application (consent is the user's);
 * - minting first-party tokens (a workspace or organization switch, the workspace list's sign-in tokens): a token
 *   minted there would carry no scopes, so an app could trade its scoped token for an unrestricted one;
 * - creating accounts and issuing invitations (`UserCreateCommand`, `InviteService`): an account an app creates,
 *   with a password or an invitation it chose, is a first-party session it holds;
 * - deleting users.
 *
 * Several of these sit behind permissions a write scope grants (`ORG_EMPLOYEES_EDIT` creates the employee's account,
 * `ORG_TEAM_ADD` sends invitations, `ALL_ORG_EDIT` deletes users), so the refusal is made where the action happens,
 * not by the permission map. First-party sessions, and every token while `OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT=false`,
 * pass.
 *
 * @param action What the caller tried, for the refusal message.
 * @throws ForbiddenException for an OAuth-app token.
 */
export function assertFirstPartyRequest(action: string): void {
	if (RequestContext.currentOAuthAppScopes() !== null) {
		throw new ForbiddenException(`${action} is not available to a third-party application token`);
	}
}
