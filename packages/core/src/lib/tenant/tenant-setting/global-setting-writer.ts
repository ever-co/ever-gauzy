/**
 * Who may write the installation-wide settings (the rows with `tenantId IS NULL`).
 *
 * A global row is the default every tenant falls back to (`resolvedSettings`), and among them are the targets of
 * every tenant's analytics and error reports: the PostHog key and host, Jitsu and Sentry. `GLOBAL_SETTING` alone
 * cannot guard them: it is a default permission of every tenant's SUPER_ADMIN, and anyone can register a tenant, so
 * on a shared installation the owner of any tenant could send every other tenant's events and errors to a server
 * of their own. The writer must also operate the installation, the way the ever-instance plugin's operator check
 * defines it (`EverOperatorService`, which core cannot import):
 *
 * - when `EVER_OPERATOR_USER_IDS` (Gauzy user ids, comma separated) is set, a user it lists;
 * - otherwise, on an installation with exactly one tenant, whose super admin is the one who runs the server.
 *
 * With more than one tenant and no list, nobody: the installation sets the list to name its operators.
 */
export const OPERATOR_USER_IDS_ENV = 'EVER_OPERATOR_USER_IDS';

/**
 * The user ids of `EVER_OPERATOR_USER_IDS`, lower-cased, or `null` when it is unset or empty.
 *
 * @param env The environment to read, the process's by default.
 */
export function operatorUserIds(env: Record<string, string | undefined> = process.env): string[] | null {
	const ids = (env[OPERATOR_USER_IDS_ENV] ?? '')
		.split(',')
		.map((id) => id.trim().toLowerCase())
		.filter((id) => id.length > 0);
	return ids.length ? ids : null;
}

/**
 * Whether the user may write the installation-wide settings.
 *
 * @param userId The signed-in user, if any.
 * @param tenantCount How many tenants the installation has. Only read when no operator list is set.
 * @param env The environment to read, the process's by default.
 */
export async function mayWriteGlobalSettings(
	userId: string | null | undefined,
	tenantCount: () => Promise<number>,
	env: Record<string, string | undefined> = process.env
): Promise<boolean> {
	const listed = operatorUserIds(env);
	if (listed) {
		return typeof userId === 'string' && listed.includes(userId.toLowerCase());
	}
	return (await tenantCount()) === 1;
}
