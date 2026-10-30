import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { EverInstanceService } from '@gauzy/plugin-ever-instance';
import { EVER_CONNECT_CLOCK, URL_CHECK_AUDIENCE, URL_CHECK_MAX_S } from '../ever-connect.constants';
import { errorCode } from '../ever-connect-platform.service';
import { EverConnectStore } from '../ever-connect.store';
import { signCompactJws } from '../sdk';

/** Where the statement is served: outside the API's `/api` prefix. */
export const WELL_KNOWN_PATH = '/.well-known/ever-connect';

/** The longest address the statement names (the connection row's `publicUrl`). */
const MAX_URL_LENGTH = 255;

/**
 * `GET /.well-known/ever-connect`: lets Ever Platform check that this installation answers at the
 * address it was given, after the `instance_url` integration was consented and accepted.
 *
 * While a check is pending (at most 10 minutes) it answers a short-lived statement signed with this
 * installation's connection key (compact JWS, `EdDSA`):
 * `{iss: <the installation's Registry id>, aud: "urn:ever:instance-url", url, iat, exp}`, with
 * `exp` at most 10 minutes after `iat`. At any other time, and when the installation is not
 * connected, it answers exactly as a route that does not exist (404). It is registered on the HTTP
 * server itself, outside `/api`, only when this module is loaded (`EVER_CONNECT_ENABLED=true`).
 */
@Injectable()
export class EverConnectWellKnownService implements OnModuleInit {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;

	constructor(
		private readonly store: EverConnectStore,
		private readonly instance: EverInstanceService,
		@Optional() private readonly adapterHost?: HttpAdapterHost,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	/**
	 * Registered before Nest's own not-found handler (which is added after the modules are
	 * initialised), so that handler still answers every other request.
	 */
	onModuleInit(): void {
		const adapter = this.adapterHost?.httpAdapter;
		if (!adapter || typeof adapter.get !== 'function') {
			return;
		}
		adapter.get(WELL_KNOWN_PATH, (req: unknown, res: unknown, next: () => void) => {
			this.statement()
				.then((statement) => {
					if (!statement) {
						next();
						return;
					}
					adapter.setHeader(res, 'Cache-Control', 'no-store');
					adapter.reply(res, { statement }, 200);
				})
				.catch((error) => {
					this.logger.warn(`The installation address statement could not be made (${errorCode(error)}).`);
					next();
				});
		});
	}

	/** Starts a check of `url` (the address Ever Platform was given): the statement is served for 10 minutes. */
	async beginCheck(url: string): Promise<void> {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' || parsed.username || parsed.password || url.length > MAX_URL_LENGTH) {
			throw new Error('The installation address must be https, without credentials, at most 255 characters.');
		}
		await this.store.updateConnection({ publicUrl: url, publicUrlCheckUntil: this.now() + URL_CHECK_MAX_S * 1000 });
	}

	/** Ends a pending check: the route answers 404 again. */
	async endCheck(): Promise<void> {
		await this.store.updateConnection({ publicUrlCheckUntil: null });
	}

	/** The statement while a check is pending, else `null`. */
	async statement(): Promise<string | null> {
		const connection = await this.store.connection();
		const now = this.now();
		const until = connection.publicUrlCheckUntil;
		if (
			connection.status !== 'connected' ||
			!connection.platformInstanceId ||
			!connection.publicUrl ||
			until === null ||
			until <= now
		) {
			return null;
		}
		const signer = await this.instance.connectSigner();
		if (!signer) {
			return null;
		}
		const iat = Math.floor(now / 1000);
		const exp = Math.min(iat + URL_CHECK_MAX_S, Math.floor(until / 1000));
		return signCompactJws(
			(bytes) => signer.sign(bytes),
			{ typ: 'JWT', kid: signer.kid },
			{ iss: connection.platformInstanceId, aud: URL_CHECK_AUDIENCE, url: connection.publicUrl, iat, exp }
		);
	}
}
