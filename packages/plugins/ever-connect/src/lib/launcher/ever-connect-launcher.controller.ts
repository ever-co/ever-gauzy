import { Controller, ForbiddenException, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantPermissionGuard } from '@gauzy/core';
import { EverOperatorService } from '@gauzy/plugin-ever-instance';
import type { LauncherAppsResponse, LauncherConfigResponse } from '../dto/launcher.dto';
import { organizationScope } from '../ever-connect-request';
import type { RequestWithUser } from '../ever-connect-request';
import { EverConnectStore } from '../ever-connect.store';
import { EverConnectEnabledGuard } from '../guards/ever-connect-operator.guard';
import { EverConnectLauncherService } from './ever-connect-launcher.service';
import { LauncherFirstPartyGuard } from './launcher-first-party.guard';
import { LauncherOriginGuard } from './launcher-origin.guard';

/**
 * The App Launcher of the web app's header, for a signed-in person in their own first-party session (Gauzy's tenant
 * guard, no new permission; a third-party OAuth app's token or an API token session gets 403 `first_party_only`):
 *
 * - `GET /api/ever-connect/launcher/config`: `{enabled, current, worksAppUrl, signInAvailable}`;
 * - `GET /api/ever-connect/launcher/apps?organizationId=`: the Ever apps, and the apps of the Ever organization the
 *   Gauzy organization is linked to, for an organization the person is a member of (403 otherwise).
 *
 * Registered only with `EVER_APP_LAUNCHER_ENABLED=true` (with Ever ID sign-in and the Ever Platform connection loaded);
 * otherwise both answer 404.
 * Both answer only the browser origins of `EVER_APP_LAUNCHER_ORIGINS`, are never cached by the browser
 * (`Cache-Control: no-store`) and never carry a token.
 */
@ApiTags('Ever Platform')
@ApiBearerAuth()
@UseGuards(EverConnectEnabledGuard, LauncherOriginGuard, LauncherFirstPartyGuard, TenantPermissionGuard)
@Controller('/ever-connect/launcher')
export class EverConnectLauncherController {
	constructor(
		private readonly launcher: EverConnectLauncherService,
		private readonly store: EverConnectStore,
		private readonly operator: EverOperatorService
	) {}

	@Get('config')
	@Header('Cache-Control', 'no-store')
	async config(@Req() request: RequestWithUser): Promise<LauncherConfigResponse> {
		const userId = request?.user?.id;
		if (!userId) {
			throw new ForbiddenException();
		}
		return this.launcher.settings(userId);
	}

	@Get('apps')
	@Header('Cache-Control', 'no-store')
	async apps(
		@Req() request: RequestWithUser,
		@Query('organizationId') organizationId?: string
	): Promise<LauncherAppsResponse> {
		const scope = await organizationScope(request, organizationId, this.store, this.operator);
		return this.launcher.list(scope);
	}
}
