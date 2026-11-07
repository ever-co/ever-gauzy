import { Controller, Get, Inject, Logger, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { AsanaApiClient, exchangeAsanaCode } from './client/asana-api.client';
import { AsanaConfig, isAsanaConfigured } from './asana-config';
import { AsanaOAuthStateService } from './asana-oauth-state.service';
import { asanaSyncUser, runInAsanaContext } from './asana-process';
import { AsanaTenantService } from './asana-tenant.service';
import { ASANA_CONFIG, ASANA_OAUTH_TOKEN_URL, ASANA_ROUTE_PREFIX } from './asana.constants';

/** Why the callback sent the person back without a connection. */
type CallbackError = 'not_configured' | 'denied' | 'invalid_state' | 'exchange_failed' | 'user_unreadable' | 'not_saved';

/**
 * `GET /integration/asana/callback?code&state`: where Asana sends the person after they authorized the
 * application. Public (the person arrives from Asana, not from the app), so everything rests on the
 * single-use `state`: it names the tenant and organization the connection belongs to; the query never does.
 * The code is exchanged here, once, and the tokens are written to the organization's connection inside a
 * request context built from the state; the person is then sent to the app's Asana page.
 */
@ApiExcludeController()
@Controller(ASANA_ROUTE_PREFIX)
export class AsanaAuthorizationController {
	private readonly logger = new Logger(AsanaAuthorizationController.name);

	constructor(
		@Inject(ASANA_CONFIG) private readonly config: AsanaConfig,
		private readonly oauthState: AsanaOAuthStateService,
		private readonly tenants: AsanaTenantService
	) {}

	@Public()
	@Get('/callback')
	async callback(@Query() query: Record<string, string | undefined>, @Res() response: Response): Promise<void> {
		if (!isAsanaConfigured(this.config)) {
			return this.back(response, { error: 'not_configured' });
		}
		const state = typeof query['state'] === 'string' ? query['state'] : undefined;
		const scope = await this.oauthState.consume(state);
		if (!scope) {
			return this.back(response, { error: 'invalid_state' });
		}
		const code = typeof query['code'] === 'string' ? query['code'] : '';
		if (!code || query['error']) {
			return this.back(response, { error: 'denied' });
		}
		let token;
		try {
			token = await exchangeAsanaCode(ASANA_OAUTH_TOKEN_URL, {
				code,
				clientId: this.config.clientId as string,
				clientSecret: this.config.clientSecret as string,
				redirectUri: this.config.redirectUrl as string
			});
		} catch (error) {
			this.logger.warn(`The Asana code exchange failed: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'exchange_failed' });
		}
		let user = token.user;
		if (!user) {
			try {
				const me = await new AsanaApiClient(token.accessToken, { apiUrl: this.config.apiUrl }).me();
				user = { gid: me.gid, name: me.name, email: me.email };
			} catch (error) {
				this.logger.warn(`The Asana user could not be read after connecting: ${error instanceof Error ? error.message : String(error)}`);
				return this.back(response, { error: 'user_unreadable' });
			}
		}
		try {
			const tenant = await runInAsanaContext(asanaSyncUser(scope, scope.userId ?? null), () => this.tenants.connect(scope, token, user as NonNullable<typeof user>));
			return this.back(response, { integrationId: String(tenant.id), organizationId: String(scope.organizationId) });
		} catch (error) {
			this.logger.error(`The Asana connection could not be saved: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'not_saved' });
		}
	}

	/** Sends the person to the app's Asana page (or answers JSON when no page is configured). */
	private back(response: Response, result: { error: CallbackError } | { integrationId: string; organizationId: string }): void {
		if (!this.config.postInstallUrl) {
			response.status('error' in result ? 400 : 200).json(result);
			return;
		}
		// The page may host several integrations' returns: the provider is named so each reads only its own.
		const params = new URLSearchParams({ provider: 'asana', ...(result as Record<string, string>) });
		response.redirect(`${this.config.postInstallUrl}?${params.toString()}`);
	}
}
