import * as https from 'https';
import { ensureHttpPrefix, getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { createSsrfSafeHttpsAgent } from '../util/ssrf-safe-agent';

/**
 * Where a tenant's own file storage settings may send the API.
 *
 * A tenant admin (TENANT_SETTING) chooses the service URL of the Wasabi and DigitalOcean providers and the delivery
 * URL of the Cloudinary provider. The API then connects to that URL: to validate a Wasabi configuration (an S3
 * `CreateBucket` whose error was answered back), and on every upload, read and delete of that tenant's files - a
 * Cloudinary read answers the response body back as the file. Without a rule about where those URLs may point, a
 * tenant admin could make the API request the cloud metadata service or any port on the cluster network.
 *
 * Only the tenant's settings are held to this: the installation's own storage configuration (environment variables)
 * is the operator's, and may well be a MinIO on the local network. The one exception is a Cloudinary file read, which
 * fetches a key that is already a URL as is. An installation whose tenants genuinely use a private endpoint sets
 * `GAUZY_FILE_STORAGE_ALLOW_PRIVATE_NETWORK=true`.
 */

/** The opt-out: tenant storage endpoints may then point anywhere, as before. */
export const ALLOW_PRIVATE_STORAGE_ENDPOINTS_ENV = 'GAUZY_FILE_STORAGE_ALLOW_PRIVATE_NETWORK';

/** The tenant settings that name a URL the API connects to. */
export const TENANT_STORAGE_ENDPOINT_SETTINGS: readonly string[] = [
	'wasabi_aws_service_url',
	'digitalocean_service_url',
	'cloudinary_delivery_url'
];

/** The special-use suffixes a public host never carries. */
const REFUSED_SUFFIXES: readonly string[] = ['.local', '.localhost', '.internal', '.home.arpa', '.onion'];

/**
 * Whether this installation lets tenant storage endpoints point at private networks.
 *
 * @param env - The environment (read per call, so a deployment changes it without a new build).
 */
export function allowsPrivateStorageEndpoints(env: NodeJS.ProcessEnv = process.env): boolean {
	return env[ALLOW_PRIVATE_STORAGE_ENDPOINTS_ENV] === 'true';
}

/**
 * Why a tenant-supplied storage endpoint is refused, or undefined when it may be used.
 *
 * The URL is read as the providers read it (`https://` is assumed when no scheme is given). It must use HTTPS, carry
 * no credentials, and name a public host: not a loopback, private or link-local address, not a single-label name
 * (which only resolves inside the cluster's own search domain) and not a special-use suffix such as `.internal`.
 * A public name that resolves to a private address is refused when the connection is made
 * ({@link tenantStorageHttpsAgent}).
 *
 * @param value - The setting's value.
 * @param env - The environment.
 */
export function refusalForStorageEndpoint(value: unknown, env: NodeJS.ProcessEnv = process.env): string | undefined {
	if (allowsPrivateStorageEndpoints(env)) {
		return undefined;
	}
	if (typeof value !== 'string' || !value.trim()) {
		return 'A storage endpoint must be a URL.';
	}

	const url = ensureHttpPrefix(value.trim());
	const reason = getUnsafeOutboundUrlReason(url);
	if (reason) {
		return `The storage endpoint is not allowed: ${reason}.`;
	}

	const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
	const isIpv6Literal = host.startsWith('[');
	if (!isIpv6Literal && !host.includes('.')) {
		return 'The storage endpoint must name a fully qualified host.';
	}
	if (REFUSED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
		return 'The storage endpoint must name a publicly resolvable host.';
	}

	return undefined;
}

/**
 * Why a set of tenant settings is refused because of one of its storage endpoints, or undefined.
 *
 * An absent or blank endpoint is not refused: the provider then uses the installation's own.
 *
 * @param settings - The settings being saved (name to value).
 * @param env - The environment.
 */
export function refusalForStorageSettings(
	settings: Record<string, unknown> | null | undefined,
	env: NodeJS.ProcessEnv = process.env
): string | undefined {
	if (!settings || typeof settings !== 'object') {
		return undefined;
	}

	for (const name of TENANT_STORAGE_ENDPOINT_SETTINGS) {
		const value = settings[name];
		if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
			continue;
		}

		const refusal = refusalForStorageEndpoint(value, env);
		if (refusal) {
			return `${name}: ${refusal}`;
		}
	}

	return undefined;
}

let agent: https.Agent | undefined;

/**
 * The HTTPS agent a connection to a tenant-supplied storage endpoint is made with: its DNS lookup refuses a host that
 * resolves to a private, loopback or link-local address, so a public-looking name cannot lead the API into the cluster
 * network. Undefined (the client's own agent) when the installation allows private endpoints.
 *
 * One agent for every tenant endpoint, so the S3 clients built with it are still shared per configuration.
 *
 * @param env - The environment.
 */
export function tenantStorageHttpsAgent(env: NodeJS.ProcessEnv = process.env): https.Agent | undefined {
	if (allowsPrivateStorageEndpoints(env)) {
		return undefined;
	}
	return (agent ??= createSsrfSafeHttpsAgent());
}
