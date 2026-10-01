/**
 * Test-only Keycloak realm on 127.0.0.1, shaped like Keycloak's own endpoints
 * (`/realms/<realm>/protocol/openid-connect/...`). It consents at once, checks the client secret,
 * the redirect URI and the PKCE verifier, and signs RS256 ID tokens with a key generated at start.
 * Excluded from the library build.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import type { JWK, JWTPayload } from 'jose';

type Route = (url: URL, request: IncomingMessage, response: ServerResponse) => Promise<void> | void;

interface Grant {
	redirectUri: string;
	nonce: string;
	challenge: string;
	claims: JWTPayload;
}

const KEY_ID = 'realm-rs256';

function send(response: ServerResponse, status: number, body?: unknown, location?: string): void {
	response.writeHead(status, location ? { Location: location } : { 'Content-Type': 'application/json' });
	response.end(body === undefined ? undefined : JSON.stringify(body));
}

async function formOf(request: IncomingMessage): Promise<URLSearchParams> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(chunk as Buffer);
	}
	return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

export class MockKeycloakRealm {
	/** The realm issuer, `http://127.0.0.1:<port>/realms/<realm>`. */
	issuer = '';
	/** Paths requested so far, to prove that nothing was contacted. */
	readonly requests: string[] = [];
	/** Claims of the next person who signs in. */
	nextClaims: JWTPayload = {};

	private server: Server | null = null;
	private signingKey: CryptoKey | null = null;
	private publicKey: JWK | null = null;
	private readonly grants = new Map<string, Grant>();
	private readonly routes: Record<string, Route> = {
		'/.well-known/openid-configuration': (_url, _request, response) => this.discovery(response),
		'/protocol/openid-connect/certs': (_url, _request, response) => send(response, 200, { keys: [this.publicKey] }),
		'/protocol/openid-connect/auth': (url, _request, response) => this.consent(url, response),
		'/protocol/openid-connect/token': (_url, request, response) => this.exchange(request, response)
	};

	constructor(
		private readonly realm: string,
		private readonly clientId: string,
		private readonly clientSecret: string
	) {}

	async start(): Promise<void> {
		const jose = await import('jose');
		const pair = await jose.generateKeyPair('RS256', { extractable: true });
		this.signingKey = pair.privateKey;
		this.publicKey = { ...(await jose.exportJWK(pair.publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };
		this.server = createServer((request, response) => {
			const url = new URL(request.url ?? '/', 'http://127.0.0.1');
			const prefix = `/realms/${this.realm}`;
			this.requests.push(url.pathname);
			const route = url.pathname.startsWith(prefix) ? this.routes[url.pathname.slice(prefix.length)] : undefined;
			Promise.resolve(route ? route(url, request, response) : send(response, 404, { error: 'not_found' })).catch(() =>
				send(response, 500)
			);
		});
		await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
		this.issuer = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/realms/${this.realm}`;
	}

	async stop(): Promise<void> {
		const server = this.server;
		this.server = null;
		if (server) {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}

	private discovery(response: ServerResponse): void {
		const endpoint = (name: string) => `${this.issuer}/protocol/openid-connect/${name}`;
		send(response, 200, {
			issuer: this.issuer,
			authorization_endpoint: endpoint('auth'),
			token_endpoint: endpoint('token'),
			jwks_uri: endpoint('certs'),
			userinfo_endpoint: endpoint('userinfo'),
			end_session_endpoint: endpoint('logout')
		});
	}

	private consent(url: URL, response: ServerResponse): void {
		const params = url.searchParams;
		const code = randomUUID();
		this.grants.set(code, {
			redirectUri: params.get('redirect_uri') ?? '',
			nonce: params.get('nonce') ?? '',
			challenge: params.get('code_challenge') ?? '',
			claims: { ...this.nextClaims }
		});
		const back = new URL(params.get('redirect_uri') ?? '');
		back.searchParams.set('code', code);
		back.searchParams.set('state', params.get('state') ?? '');
		send(response, 302, undefined, back.toString());
	}

	private async exchange(request: IncomingMessage, response: ServerResponse): Promise<void> {
		const credential = Buffer.from(`${encodeURIComponent(this.clientId)}:${encodeURIComponent(this.clientSecret)}`);
		if (request.headers.authorization !== `Basic ${credential.toString('base64')}`) {
			return send(response, 401, { error: 'unauthorized_client' });
		}
		const form = await formOf(request);
		const grant = this.grants.get(form.get('code') ?? '');
		this.grants.delete(form.get('code') ?? '');
		const proof = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
		if (!grant || grant.challenge !== proof || grant.redirectUri !== form.get('redirect_uri')) {
			return send(response, 400, { error: 'invalid_grant' });
		}
		const jose = await import('jose');
		const issuedAt = Math.floor(Date.now() / 1000);
		const idToken = await new jose.SignJWT({ azp: this.clientId, nonce: grant.nonce, ...grant.claims })
			.setProtectedHeader({ alg: 'RS256', kid: KEY_ID, typ: 'JWT' })
			.setIssuer(this.issuer)
			.setAudience(this.clientId)
			.setSubject(String(grant.claims.sub ?? 'realm-user'))
			.setIssuedAt(issuedAt)
			.setExpirationTime(issuedAt + 300)
			.sign(this.signingKey);
		send(response, 200, { access_token: 'realm-access-token', id_token: idToken, token_type: 'Bearer', expires_in: 300 });
	}
}
