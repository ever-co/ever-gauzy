import { IUser, LanguagesEnum, PermissionsEnum } from "@gauzy/contracts";
import type { IOAuthAppTokenGrant } from "../../auth/oauth-app-scope";

/**
 * Represents a serialized version of a request context.
 */
export type SerializedRequestContext = {
    _req?: any;               // Serialized request object
    _languageCode?: LanguagesEnum;  // Serialized language code
    _isAuthorized?: boolean;  // Serialized authorization status
};

/**
 * The user object attached to the request by `JwtStrategy` (and by the guards that authenticate a
 * caller themselves, such as `RegisterAuthorizationGuard`).
 *
 * It carries the DATABASE state of the caller, not the claims of their token: `role` is the role the
 * user holds right now and `permissions` are that role's currently enabled permissions. Authorization
 * must be decided from these — a token's `role` / `permissions` claims are frozen at issuance and stay
 * valid for the token's whole lifetime after a demotion.
 */
export interface IAuthenticatedUser extends IUser {
    /**
     * Enabled permissions of the user's CURRENT role, resolved from the database per request. For a request
     * authenticated by a third-party OAuth-app token, only those its approved scopes allow (see `oauthApp`).
     */
    permissions?: PermissionsEnum[];
    /**
     * Set by `JwtStrategy` only when the request is authenticated by a third-party OAuth-app token (and
     * `OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT` is not `false`): the client the user approved and the scopes they
     * approved. Its presence is what makes role checks refuse and permission checks narrow
     * (`RequestContext.currentOAuthAppScopes()`, `auth/oauth-app-scope.ts`).
     */
    oauthApp?: IOAuthAppTokenGrant;
}
