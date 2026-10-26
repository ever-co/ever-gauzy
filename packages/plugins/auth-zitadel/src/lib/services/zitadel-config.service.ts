import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { OidcIssuerConfig } from '@gauzy/auth';
import { AUTH_ZITADEL_SETTINGS } from '../auth-zitadel.tokens';
import { AuthZitadelSettings, ZitadelLinkMode, isEverHost, issuerProblem, stripTrailingSlashes } from '../auth-zitadel.config';
import { EVER_CONNECT_CONFIG, EverConnectConfigPort } from '../ports/ever-connect-config.port';

/** The answer of `GET /api/auth/zitadel/config`. */
export interface ZitadelPublicConfig {
	enabled: boolean;
	reason?: 'unconfigured' | 'ever_issuer_requires_connect';
	issuer?: string;
	link_modes?: ZitadelLinkMode[];
	jit?: boolean;
	signup?: boolean;
}

/** The issuers and client in effect for one request. */
export interface ZitadelResolvedConfig {
	issuers: OidcIssuerConfig[];
}

/**
 * Resolves the issuers and client the plugin may use right now.
 *
 * The environment wins per key. Only when it configures no issuer or client does the optional
 * connected-instance port get asked, and an issuer on an Ever host is accepted on a non-cloud
 * install only when that port reports the Ever ID sign-in integration as enabled. Without the port
 * (the normal case today) a non-cloud install never contacts an Ever issuer.
 */
@Injectable()
export class ZitadelConfigService {
	private readonly logger = new Logger(ZitadelConfigService.name);

	constructor(
		@Inject(AUTH_ZITADEL_SETTINGS) readonly settings: AuthZitadelSettings,
		@Optional() @Inject(EVER_CONNECT_CONFIG) private readonly everConnect?: EverConnectConfigPort
	) {}

	/** The issuers and client in effect, or an empty list when the plugin is not configured. */
	async resolve(): Promise<ZitadelResolvedConfig> {
		const settings = this.settings;
		let issuers = [...settings.issuers];
		let clientId = settings.clientId;
		let clientSecret = settings.clientSecret;

		const everIssuers = await this.everIssuersAllowedByConnect();
		issuers.push(...everIssuers.filter((issuer) => !issuers.includes(issuer)));

		if ((!issuers.length || !clientId || !clientSecret) && this.everConnect && settings.everConnectEnabled) {
			const fromConnect = await this.safe(() => this.everConnect.getEverIdLoginConfig(), null);
			const connectIssuer = fromConnect?.issuer ? stripTrailingSlashes(fromConnect.issuer) : '';
			// The connected instance's issuer passes the same checks as one from the environment, and
			// its client is used for that issuer only, never for another one.
			const usable =
				!!connectIssuer &&
				!issuerProblem(connectIssuer) &&
				(settings.isCloud || !isEverHost(connectIssuer) || (await this.connectAllowsEverIssuer()));
			if (usable && (!issuers.length || issuers.includes(connectIssuer))) {
				issuers = [connectIssuer];
				clientId = clientId || fromConnect.clientId;
				clientSecret = clientSecret || fromConnect.clientSecret;
			}
		}

		if (!issuers.length || !clientId || !clientSecret) {
			return { issuers: [] };
		}
		return {
			issuers: issuers.map((issuer) => ({
				issuer,
				clientId,
				clientSecret,
				redirectUri: settings.callbackUrl,
				scopes: settings.scopes
			}))
		};
	}

	/** The issuer config for `issuer`, if it is one of the issuers in effect. */
	async issuer(issuer: string): Promise<OidcIssuerConfig | null> {
		const { issuers } = await this.resolve();
		return issuers.find((config) => config.issuer === issuer) ?? null;
	}

	/** The primary issuer config; 404 when the plugin is not configured. */
	async primary(): Promise<OidcIssuerConfig> {
		const { issuers } = await this.resolve();
		if (!issuers.length) {
			throw new NotFoundException();
		}
		return issuers[0];
	}

	/** Whether any issuer is in effect. */
	async isConfigured(): Promise<boolean> {
		return (await this.resolve()).issuers.length > 0;
	}

	/** What the login page and the settings page need to know. */
	async publicConfig(): Promise<ZitadelPublicConfig> {
		const { issuers } = await this.resolve();
		if (!issuers.length) {
			const onlyEverIssuers = this.settings.everIssuersAwaitingConnect.length > 0 && this.settings.issuers.length === 0;
			return { enabled: false, reason: onlyEverIssuers ? 'ever_issuer_requires_connect' : 'unconfigured' };
		}
		return {
			enabled: true,
			issuer: issuers[0].issuer,
			link_modes: this.settings.linkMode === 'confirmed' ? ['explicit', 'confirmed'] : ['explicit'],
			jit: false,
			signup: this.settings.signupEnabled
		};
	}

	private async everIssuersAllowedByConnect(): Promise<string[]> {
		if (!this.settings.everIssuersAwaitingConnect.length) {
			return [];
		}
		return (await this.connectAllowsEverIssuer()) ? [...this.settings.everIssuersAwaitingConnect] : [];
	}

	private async connectAllowsEverIssuer(): Promise<boolean> {
		if (!this.settings.everConnectEnabled || !this.everConnect) {
			return false;
		}
		return this.safe(() => this.everConnect.isEverIdLoginEnabled(), false);
	}

	private async safe<T>(call: () => Promise<T>, fallback: T): Promise<T> {
		try {
			return await call();
		} catch (error) {
			this.logger.warn(`Connected-instance settings unavailable: ${error instanceof Error ? error.message : 'error'}`);
			return fallback;
		}
	}
}
