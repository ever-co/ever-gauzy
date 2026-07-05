import { Injectable } from '@angular/core';
import { EMPTY, Observable, from, map, switchMap, throwError } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { PluginSubscriptionAccessService } from '../../services/plugin-subscription-access.service';
import { PluginService } from '../../services/plugin.service';
import { IInstallationCommand } from '../interfaces';

/**
 * Parameters for activate plugin command
 * marketplaceId can be null for local/direct installations
 */
export interface IActivatePluginCommandParams {
	marketplaceId: string | null;
	installationId?: string;
	/** Plugin name, used to look up locally installed plugins when marketplaceId is absent */
	name?: string;
}

/**
 * Result of activate plugin command
 */
export interface IActivatePluginCommandResult {
	success: boolean;
	plugin?: IPlugin;
	message?: string;
}

/**
 * Command for activating a plugin
 * Following Command Pattern - encapsulates plugin activation
 * Following Single Responsibility Principle - only handles activation
 */
@Injectable({
	providedIn: 'root'
})
export class ActivatePluginCommand
	implements IInstallationCommand<IActivatePluginCommandParams, IActivatePluginCommandResult>
{
	constructor(
		private readonly pluginService: PluginService,
		private readonly pluginElectronService: PluginElectronService,
		private readonly accessService: PluginSubscriptionAccessService
	) {}

	/**
	 * Executes the activate plugin command
	 * For local installations (marketplaceId is null), skip server validation and access checks
	 */
	public execute(params: IActivatePluginCommandParams): Observable<IActivatePluginCommandResult> {
		const { marketplaceId, installationId, name } = params;

		// For local installations, skip marketplace-specific checks
		if (!marketplaceId) {
			// name is the only reliable look-up key for local plugins.
			// installationId is a backend DB record ID, not a marketplaceId, so it
			// cannot be passed to checkInstallation (which expects a marketplaceId).
			if (!name) {
				return throwError(
					() =>
						new Error(
							'Cannot activate plugin: plugin name must be provided for local installations.'
						)
				);
			}
			// Direct local activation without server validation.
			return from(this.pluginElectronService.plugin(name)).pipe(
				switchMap((plugin) => {
					// Guard against null/undefined plugin before proceeding.
					if (!plugin) {
						return throwError(() => new Error('Plugin not found'));
					}
					// SECURITY GUARD: Even though the caller did not supply a marketplaceId,
					if (plugin?.marketplaceId) {
						return throwError(
							() =>
								new Error(
									'This plugin is registered in the marketplace and must be activated through the marketplace.'
								)
						);
					}

					this.pluginElectronService.activate(plugin);

					return this.pluginElectronService.progress<void, IPlugin>().pipe(
						map(({ data, message }) => ({
							success: true,
							plugin: data || plugin,
							message
						}))
					);
				})
			);
		}

		// For marketplace installations, verify access and validate with server
		return this.accessService.checkAccess(marketplaceId).pipe(
			switchMap((access) => {
				if (!access.hasAccess) {
					return throwError(() => new Error('You do not have access to activate this plugin'));
				}

				// Validate with server then activate locally
				return this.pluginService.activate(marketplaceId, installationId).pipe(
					switchMap(() => from(this.pluginElectronService.checkInstallation(marketplaceId))),
					switchMap((plugin) => {
						this.pluginElectronService.activate(plugin);

						return this.pluginElectronService.progress<void, IPlugin>().pipe(
							map(({ data, message }) => ({
								success: true,
								plugin: data || plugin,
								message
							}))
						);
					})
				);
			})
		);
	}

	/**
	 * Rollback activation (deactivate)
	 */
	public undo(params: IActivatePluginCommandParams): Observable<void> {
		return this.pluginService.deactivate(params.marketplaceId, params.installationId).pipe(
			switchMap(() => from(this.pluginElectronService.checkInstallation(params.marketplaceId))),
			switchMap((plugin) => {
				this.pluginElectronService.deactivate(plugin);
				return this.pluginElectronService.progress<void, IPlugin>().pipe(switchMap(() => EMPTY));
			})
		);
	}
}
