import { Controller, Get, Inject, Logger, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@gauzy/common';
import { exchangeLinearCode, LinearApiClient } from './client/linear-api.client';
import { isLinearConfigured, LinearConfig } from './linear-config';
import { LinearOAuthStateService } from './linear-oauth-state.service';
import { linearSyncUser, runInLinearContext } from './linear-process';
import { LinearTenantService } from './linear-tenant.service';
import { LINEAR_CONFIG, LINEAR_OAUTH_TOKEN_URL, LINEAR_ROUTE_PREFIX } from './linear.constants';

/** Why the callback sent the person back without a connection. */
type CallbackError = 'not_configured' | 'denied' | 'invalid_state' | 'exchange_failed' | 'workspace_unreadable' | 'not_saved';

/**
 * `GET /integration/linear/callback?code&state`: where Linear sends the person after they authorized the
 * application. Public (the person arrives from Linear, not from the app), so everything rests on the
 * single-use `state`: it names the tenant and organization the connection belongs to; the query never
 * does. The code is exchanged here, once, and the token is written to the organization's connection;
 * the person is then sent to the app's Linear page, always the server-side configured one.
 */
@ApiExcludeController()
@Controller(LINEAR_ROUTE_PREFIX)
export class LinearAuthorizationController {
	private readonly logger = new Logger(LinearAuthorizationController.name);

	constructor(
		@Inject(LINEAR_CONFIG) private readonly config: LinearConfig,
		private readonly oauthState: LinearOAuthStateService,
		private readonly tenants: LinearTenantService
	) {}

	@Public()
	@Get('/callback')
	async callback(@Query() query: Record<string, string | undefined>, @Res() response: Response): Promise<void> {
		if (!isLinearConfigured(this.config)) {
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
			token = await exchangeLinearCode(LINEAR_OAUTH_TOKEN_URL, {
				code,
				clientId: this.config.clientId as string,
				clientSecret: this.config.clientSecret as string,
				redirectUri: this.config.redirectUrl as string
			});
		} catch (error) {
			this.logger.warn(`The Linear code exchange failed: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'exchange_failed' });
		}
		let viewer;
		try {
			viewer = await new LinearApiClient(token.accessToken, { apiUrl: this.config.apiUrl, tokenType: token.tokenType }).viewer();
		} catch (error) {
			this.logger.warn(`The Linear workspace could not be read after connecting: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'workspace_unreadable' });
		}
		try {
			// The request is public (no user, no tenant): the connection is written inside a request context built
			// from the consumed state, so the platform's tenant-aware services scope it to that tenant.
			const tenant = await runInLinearContext(linearSyncUser(scope, scope.userId ?? null), () => this.tenants.connect(scope, token, viewer));
			return this.back(response, { integrationId: String(tenant.id), organizationId: String(scope.organizationId) });
		} catch (error) {
			this.logger.error(`The Linear connection could not be saved: ${error instanceof Error ? error.message : String(error)}`);
			return this.back(response, { error: 'not_saved' });
		}
	}

	/** Sends the person to the app's Linear page (or answers JSON when no page is configured). */
	private back(response: Response, result: { error: CallbackError } | { integrationId: string; organizationId: string }): void {
		if (!this.config.postInstallUrl) {
			response.status('error' in result ? 400 : 200).json(result);
			return;
		}
		// The page may host several integrations' returns: the provider is named so each reads only its own.
		const params = new URLSearchParams({ provider: 'linear', ...(result as Record<string, string>) });
		response.redirect(`${this.config.postInstallUrl}?${params.toString()}`);
	}
}
