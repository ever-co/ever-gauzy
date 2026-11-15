/**
 * The lifetime of a refresh token when `JWT_REFRESH_TOKEN_EXPIRATION_TIME` is not set, in seconds (7 days).
 *
 * It is stated once, for everything that reads it: the environment, the module that mints the refresh tokens, and
 * the session code that counts how long a token of a session can stay valid. They used to state two (7 days here,
 * 30 where the token is minted), so a deployment without the variable minted tokens that outlived what the rest of
 * the API took their lifetime to be.
 *
 * A refresh token must outlive the access token it is issued with (`JWT_TOKEN_EXPIRATION_TIME`, one day by
 * default). The two are always issued together: with equal lifetimes they expire at the same second, and a client
 * that was closed, asleep or offline at that moment has nothing left to renew its session with.
 */
export const DEFAULT_JWT_REFRESH_TOKEN_EXPIRATION_TIME = 86400 * 7;
