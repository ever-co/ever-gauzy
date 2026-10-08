/**
 * The two compact JWS (RFC 7515, `alg: EdDSA`) helpers the SDK does not export:
 *
 * - {@link signCompactJws} signs the statistics link statement with the statistics key;
 * - {@link readJwsPayload} reads the claims of an entitlement document this plugin already verified
 *   with the SDK before storing it, for display only. It never verifies anything.
 */

const b64url = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString('base64url');

/** Signs a compact JWS (`alg: EdDSA`) with a signer of raw bytes. */
export async function signCompactJws(
	sign: (bytes: Uint8Array) => Promise<Uint8Array> | Uint8Array,
	header: Record<string, unknown>,
	payload: Record<string, unknown>
): Promise<string> {
	const input = `${b64url(JSON.stringify({ alg: 'EdDSA', ...header }))}.${b64url(JSON.stringify(payload))}`;
	const signature = await sign(new TextEncoder().encode(input));
	return `${input}.${b64url(signature)}`;
}

/** The longest document read (as the SDK's verifier). */
const MAX_LENGTH = 65536;
const PART = /^[A-Za-z0-9_-]+$/;

/** The payload object of a compact JWS, or null unless it is three base64url parts with a JSON object payload. */
export function readJwsPayload(token: unknown): Record<string, unknown> | null {
	if (typeof token !== 'string' || token.length > MAX_LENGTH) {
		return null;
	}
	const parts = token.split('.');
	if (parts.length !== 3 || !parts.every((part) => PART.test(part))) {
		return null;
	}
	try {
		const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown;
		return payload && typeof payload === 'object' && !Array.isArray(payload)
			? (payload as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}
