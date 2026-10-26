/**
 * The environment variable that puts the role's permission list back into access tokens.
 *
 * Access tokens used to embed the name of every enabled permission of the user's role (an 11.5 KB token for a
 * super admin, growing ~30 bytes with each new permission) — past the 8 KB header line nginx accepts by default and
 * on the way to Node's 16 KB cap for all request headers. Nothing in the platform reads that claim: requests are
 * authorized against the role's CURRENT permissions, loaded from the database by `JwtStrategy`, and clients load
 * them from `/user/me`. The list is therefore left out of new tokens; an integration that still decodes it from the
 * token can have it back with `JWT_ACCESS_TOKEN_INCLUDE_PERMISSIONS=true` while it moves to `/user/me`.
 */
export const ACCESS_TOKEN_PERMISSIONS_ENV = 'JWT_ACCESS_TOKEN_INCLUDE_PERMISSIONS';

/**
 * Whether new access tokens carry the role's permission list.
 *
 * @returns True only when {@link ACCESS_TOKEN_PERMISSIONS_ENV} is `true`.
 */
export function accessTokenCarriesPermissions(): boolean {
	return String(process.env[ACCESS_TOKEN_PERMISSIONS_ENV] ?? '').trim().toLowerCase() === 'true';
}
