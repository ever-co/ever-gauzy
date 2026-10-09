/**
 * Test-only OpenID Provider on 127.0.0.1: discovery, key set, an authorize endpoint that consents at
 * once, and a token endpoint that checks the client, the redirect URI and the PKCE verifier. Keys are
 * generated when it starts. Excluded from the library build.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import type { JWK, JWTPayload } from 'jose';

type Jose = typeof import('jose');

interface PendingCode {
	clientId: string;
	redirectUri: string;
	nonce: string;
	codeChallenge: string;
	claims: JWTPayload;
}

export class MockOidcIssuer {
	issuer = '';
	readonly kid = 'mock-es256';
	/** Every request the issuer received (method and path), for egress assertions. */
	readonly requests: Array<{ method: string; path: string }> = [];
	/** Claims merged into the next ID token the token endpoint issues. */
	nextClaims: JWTPayload = {};
	/** When set, the authorize endpoint answers with this OAuth error instead of a code. */
	authorizeError: string | null = null;
	/** The last authorize request's query parameters. */
	lastAuthorizeQuery: URLSearchParams | null = null;

	private server: Server | null = null;
	private jose: Jose | null = null;
	private privateKey: CryptoKey | null = null;
	private publicJwk: JWK | null = null;
	private readonly codes = new Map<string, PendingCode>();

	constructor(
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly pathPrefix = ''
	) {}

	async start(): Promise<void> {
		this.jose = await import('jose');
		const { privateKey, publicKey } = await this.jose.generateKeyPair('ES256', { extractable: true });
		this.privateKey = privateKey;
		this.publicJwk = { ...(await this.jose.exportJWK(publicKey)), kid: this.kid, alg: 'ES256', use: 'sig' };
		this.server = createServer((req, res) => {
			this.handle(req, res).catch(() => {
				res.statusCode = 500;
				res.end();
			});
		});
		await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
		const { port } = this.server.address() as AddressInfo;
		this.issuer = `http://127.0.0.1:${port}${this.pathPrefix}`;
	}

	async stop(): Promise<void> {
		if (this.server) {
			// Keep-alive connections from the API under test would otherwise hold the server open.
			this.server.closeAllConnections();
			await new Promise<void>((resolve) => this.server.close(() => resolve()));
			this.server = null;
		}
	}

	/** Signs a token with the issuer's key (ID token, access token or logout token). */
	async sign(claims: JWTPayload, header: Record<string, unknown> = {}): Promise<string> {
		return new this.jose.SignJWT(claims)
			.setProtectedHeader({ alg: 'ES256', kid: this.kid, typ: 'JWT', ...header })
			.sign(this.privateKey);
	}

	/** Standard ID token claims for `subject`. */
	idTokenClaims(subject: string, overrides: JWTPayload = {}): JWTPayload {
		const now = Math.floor(Date.now() / 1000);
		return {
			iss: this.issuer,
			sub: subject,
			aud: this.clientId,
			azp: this.clientId,
			iat: now,
			exp: now + 600,
			auth_time: now,
			email: `${subject}@example.test`,
			email_verified: true,
			given_name: 'Test',
			family_name: 'Person',
			sid: `sid-${subject}`,
			...overrides
		};
	}

	private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		const path = url.pathname.startsWith(this.pathPrefix) ? url.pathname.slice(this.pathPrefix.length) : url.pathname;
		this.requests.push({ method: req.method ?? 'GET', path });

		if (path === '/.well-known/openid-configuration') {
			return this.json(res, 200, {
				issuer: this.issuer,
				authorization_endpoint: `${this.issuer}/oauth/v2/authorize`,
				token_endpoint: `${this.issuer}/oauth/v2/token`,
				userinfo_endpoint: `${this.issuer}/oidc/v1/userinfo`,
				jwks_uri: `${this.issuer}/oauth/v2/keys`,
				end_session_endpoint: `${this.issuer}/oidc/v1/end_session`
			});
		}
		if (path === '/oauth/v2/keys') {
			return this.json(res, 200, { keys: [this.publicJwk] });
		}
		if (path === '/oauth/v2/authorize') {
			return this.authorize(url.searchParams, res);
		}
		if (path === '/oauth/v2/token' && req.method === 'POST') {
			return this.token(req, res);
		}
		return this.json(res, 404, { error: 'not_found' });
	}

	private authorize(query: URLSearchParams, res: ServerResponse): void {
		this.lastAuthorizeQuery = query;
		const redirectUri = query.get('redirect_uri') ?? '';
		const target = new URL(redirectUri);
		target.searchParams.set('state', query.get('state') ?? '');
		if (this.authorizeError) {
			target.searchParams.set('error', this.authorizeError);
		} else {
			const code = randomBytes(16).toString('hex');
			this.codes.set(code, {
				clientId: query.get('client_id') ?? '',
				redirectUri,
				nonce: query.get('nonce') ?? '',
				codeChallenge: query.get('code_challenge') ?? '',
				claims: this.nextClaims
			});
			// The claims belong to this authorization only; a later one starts from the defaults.
			this.nextClaims = {};
			target.searchParams.set('code', code);
		}
		res.statusCode = 302;
		res.setHeader('Location', target.toString());
		res.end();
	}

	private async token(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const body = new URLSearchParams(await this.readBody(req));
		// `client_secret_basic` form-encodes id and secret before joining them (RFC 6749, section 2.3.1).
		const formEncode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
		const credential = Buffer.from(`${formEncode(this.clientId)}:${formEncode(this.clientSecret)}`).toString('base64');
		const expected = `Basic ${credential}`;
		if (req.headers['authorization'] !== expected) {
			return this.json(res, 401, { error: 'invalid_client' });
		}
		const pending = this.codes.get(body.get('code') ?? '');
		this.codes.delete(body.get('code') ?? '');
		const verifier = body.get('code_verifier') ?? '';
		const challenge = createHash('sha256').update(verifier).digest('base64url');
		if (!pending || pending.clientId !== this.clientId || pending.redirectUri !== body.get('redirect_uri') || pending.codeChallenge !== challenge) {
			return this.json(res, 400, { error: 'invalid_grant' });
		}
		const subject = String(pending.claims.sub ?? 'person-1');
		const idToken = await this.sign(this.idTokenClaims(subject, { nonce: pending.nonce, ...pending.claims }));
		return this.json(res, 200, { id_token: idToken, access_token: 'opaque-access-token', token_type: 'Bearer', expires_in: 600 });
	}

	private readBody(req: IncomingMessage): Promise<string> {
		return new Promise((resolve) => {
			let data = '';
			req.on('data', (chunk) => (data += chunk));
			req.on('end', () => resolve(data));
		});
	}

	private json(res: ServerResponse, status: number, body: unknown): void {
		res.statusCode = status;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(body));
	}
}
