/**
 * Interface for ActivePieces Integration Configuration
 *
 * Every value here belongs to the operator of the installation. None of them is ever handed to a tenant: a tenant's
 * requests either use the tenant's own Activepieces key, or are confined by the server to the tenant's own project.
 */
export interface IActivepiecesConfig {
	/**
	 * API key for authenticating Activepieces API calls (Platform/Enterprise).
	 *
	 * An Activepieces API key belongs to a whole platform: every project on it. A tenant request never uses it without
	 * the tenant's own project pinned by the server (`GAUZY_ACTIVEPIECES_API_KEY`).
	 */
	readonly apiKey?: string;

	/**
	 * The id of the platform's signing key (Platform Settings → Signing Keys), the `kid` of the tokens the server signs
	 * to obtain a tenant's project token (`GAUZY_ACTIVEPIECES_SIGNING_KEY_ID`).
	 */
	readonly signingKeyId?: string;

	/**
	 * The private key (RS256, PEM; `\n`-escaped or base64 also accepted) of that signing key
	 * (`GAUZY_ACTIVEPIECES_SIGNING_PRIVATE_KEY`). With the key id, it turns the project-token mode on.
	 */
	readonly signingPrivateKey?: string;

	/**
	 * Whether a tenant without a key of its own may use the platform key, confined to a project the server creates for
	 * it (`GAUZY_ACTIVEPIECES_TENANT_PROJECTS`, on unless `false`).
	 */
	readonly tenantProjectsEnabled?: boolean;

	/**
	 * The prefix of the external id of a tenant's Activepieces project and user: `<prefix><tenantId>`
	 * (`GAUZY_ACTIVEPIECES_PROJECT_EXTERNAL_ID_PREFIX`, `gauzy-tenant-` by default). Give each installation sharing one
	 * Activepieces platform its own prefix (a stage restored from production has the same tenant ids).
	 */
	readonly projectExternalIdPrefix?: string;
}
