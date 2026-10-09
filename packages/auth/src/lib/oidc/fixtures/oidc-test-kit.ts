/**
 * Test-only helpers for the OIDC library specs. Excluded from the library build.
 *
 * Keys are generated when a test runs; no private key is ever committed.
 */
import { randomBytes } from 'node:crypto';
import type { JWK, JWTPayload } from 'jose';
import { loadJose } from '../jose-loader';
import { OidcHttpResponse } from '../oidc-http.service';
import { OidcDiscoveryDocument, OidcSigningAlgorithm } from '../oidc.types';

export interface TestSigningKey {
	alg: OidcSigningAlgorithm | 'HS256';
	kid: string;
	privateKey: CryptoKey | Uint8Array;
	publicJwk?: JWK;
}

/** Generates an asymmetric key pair for `alg` and returns its public JWK with a `kid`. */
export async function generateSigningKey(alg: OidcSigningAlgorithm, kid = `${alg}-${randomBytes(4).toString('hex')}`): Promise<TestSigningKey> {
	const jose = await loadJose();
	const { privateKey, publicKey } = await jose.generateKeyPair(alg, { extractable: true });
	const publicJwk = await jose.exportJWK(publicKey);
	return { alg, kid, privateKey, publicJwk: { ...publicJwk, kid, alg, use: 'sig' } };
}

/** A random symmetric key, used to prove that `HS256` tokens are refused. */
export function generateSymmetricKey(kid = 'hs256-test'): TestSigningKey {
	return { alg: 'HS256', kid, privateKey: new Uint8Array(randomBytes(32)) };
}

/** Signs a JWT with a test key. */
export async function signTestToken(
	key: TestSigningKey,
	claims: JWTPayload,
	header: Record<string, unknown> = {}
): Promise<string> {
	const jose = await loadJose();
	return new jose.SignJWT(claims)
		.setProtectedHeader({ alg: key.alg, kid: key.kid, typ: 'JWT', ...header })
		.sign(key.privateKey);
}

/** A discovery document whose endpoints all live on the issuer origin. */
export function discoveryDocumentFor(issuer: string): OidcDiscoveryDocument {
	return {
		issuer,
		authorization_endpoint: `${issuer}/oauth/v2/authorize`,
		token_endpoint: `${issuer}/oauth/v2/token`,
		userinfo_endpoint: `${issuer}/oidc/v1/userinfo`,
		jwks_uri: `${issuer}/oauth/v2/keys`,
		end_session_endpoint: `${issuer}/oidc/v1/end_session`
	};
}

/** A recorded request of {@link FakeOidcHttp}. */
export interface RecordedRequest {
	method: 'GET' | 'POST';
	url: string;
	headers: Record<string, string>;
	form?: Record<string, string>;
}

type Responder = (request: RecordedRequest) => OidcHttpResponse | Promise<OidcHttpResponse>;

/**
 * A stand-in for `OidcHttpService` that answers from a route table and records every request,
 * so specs can assert exactly which URLs were (or were not) requested.
 */
export class FakeOidcHttp {
	readonly requests: RecordedRequest[] = [];
	private readonly routes = new Map<string, Responder>();

	/** Answers `url` with `responder` (or a fixed response). */
	on(url: string, responder: Responder | OidcHttpResponse): this {
		this.routes.set(url, typeof responder === 'function' ? responder : () => responder);
		return this;
	}

	/** Makes `url` fail like an unreachable host. */
	fail(url: string): this {
		this.routes.set(url, () => {
			throw new Error('host unreachable');
		});
		return this;
	}

	async get(url: string, headers: Record<string, string> = {}): Promise<OidcHttpResponse> {
		return this.dispatch({ method: 'GET', url, headers });
	}

	async postForm(url: string, form: Record<string, string>, headers: Record<string, string> = {}): Promise<OidcHttpResponse> {
		return this.dispatch({ method: 'POST', url, headers, form });
	}

	/** Requests made to `url`. */
	calls(url: string): RecordedRequest[] {
		return this.requests.filter((request) => request.url === url);
	}

	private async dispatch(request: RecordedRequest): Promise<OidcHttpResponse> {
		this.requests.push(request);
		const responder = this.routes.get(request.url);
		if (!responder) {
			return { status: 404, data: { error: 'not_found' } };
		}
		return responder(request);
	}
}

/** Publishes an issuer's discovery document and key set on a {@link FakeOidcHttp}. */
export function publishIssuer(http: FakeOidcHttp, issuer: string, keys: TestSigningKey[]): OidcDiscoveryDocument {
	const document = discoveryDocumentFor(issuer);
	http.on(`${issuer}/.well-known/openid-configuration`, { status: 200, data: document });
	http.on(document.jwks_uri, { status: 200, data: { keys: keys.filter((key) => key.publicJwk).map((key) => key.publicJwk) } });
	return document;
}

/** A random secret for a test run. */
export function randomTestSecret(): string {
	return randomBytes(32).toString('hex');
}
