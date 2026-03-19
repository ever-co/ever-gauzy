import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, of, switchMap, take } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginService } from '../../../../services/plugin.service';
import { PluginDeepLinkActions } from '../actions/plugin-deep-link.action';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from '../queries/plugin-marketplace.query';

export interface IDeepLinkInstallPayload {
	pluginId: string;
	versionId?: string;
	forceInstall?: boolean;
}

/**
 * Effects for deep-link driven plugin installation.
 */
@Injectable({ providedIn: 'root' })
export class PluginDeepLinkEffects {
	private readonly pluginService = inject(PluginService);
	private readonly router = inject(Router);
	private readonly toastrService = inject(ToastrNotificationService);
	private readonly translateService = inject(TranslateService);
	private readonly action$ = inject(Actions);
	private readonly pluginMarketplaceQuery = inject(PluginMarketplaceQuery);

	/**
	 * Continuously listens for `deep-link-install-plugin` IPC events sent by the
	 * main process (see `InstallPluginHandler`) and handles two happy-paths:
	 *
	 * - **Force install**: navigates to the marketplace, then immediately
	 *   dispatches `PluginMarketplaceActions.install` so `PluginInstallationEffects`
	 *   takes over.
	 *
	 * - **Review before install**: navigates to the plugin detail page and shows
	 *   an informational toastr so the user can confirm manually.
	 *
	 * Errors are caught per-event with `catchError` returning `EMPTY`, so the
	 * outer IPC stream stays alive for subsequent deep-link calls.
	 */
	handleDeepLinkInstall$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginDeepLinkActions.install),
				switchMap(({ pluginId, versionId, forceInstall }) =>
					this.pluginMarketplaceQuery.plugins$.pipe(
						take(1),
						switchMap((plugins) => {
							const plugin = plugins.find((p) => {
								if (p.id !== pluginId) return false;

								if (versionId) {
									return p.version?.id === versionId || p.versions.some((v) => v.id === versionId);
								}

								return true; // match plugin by id only
							});
							if (!plugin) {
								return this.pluginService.getOne(pluginId, {
									where: {
										versions: {
											id: versionId
										}
									}
								});
							}
							return of(plugin);
						}),
						switchMap((plugin) => {
							if (!plugin) {
								this.toastrService.error(
									this.translateService.instant('PLUGIN.DEEP_LINK.PLUGIN_NOT_FOUND')
								);
								return EMPTY;
							}
							if (forceInstall) {
								return of(PluginMarketplaceActions.install(plugin, false));
							} else {
								// Review before install path: navigate to plugin detail and show informational toastr
								this.router.navigate(['/', 'plugins', 'marketplace', plugin.id]);
								this.toastrService.info(
									this.translateService.instant('PLUGIN.DEEP_LINK.REVIEW_AND_INSTALL', {
										name: plugin.name
									})
								);
								return EMPTY; // No further action needed until user manually clicks "Install"
							}
						}),
						catchError((error) => {
							console.error('Error handling deep link install:', error);
							this.toastrService.error(
								this.translateService.instant('PLUGIN.DEEP_LINK.INSTALLATION_FAILED', {
									error: error.message || error
								})
							);
							return EMPTY; // Swallow error to keep IPC stream alive
						})
					)
				)
			),
		{ dispatch: true }
	);
}
