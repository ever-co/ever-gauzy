import { Injectable } from '@angular/core';
import { EMPTY, Observable, from, map, switchMap } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { PluginService } from '../../services/plugin.service';
import { IInstallationCommand } from '../interfaces';

/**
 * Parameters for activate plugin command
 */
export interface IActivatePluginCommandParams {
	marketplaceId: string;
	installationId?: string;
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
		private readonly pluginElectronService: PluginElectronService
	) {}

	/**
	 * Executes the activate plugin command
	 */
	public execute(params: IActivatePluginCommandParams): Observable<IActivatePluginCommandResult> {
		const { marketplaceId, installationId } = params;

		// First validate with server
		return this.pluginService.activate(marketplaceId, installationId).pipe(
			switchMap(() => from(this.pluginElectronService.checkInstallation(marketplaceId))),
			switchMap((plugin) => {
				// Activate locally
				this.pluginElectronService.activate(plugin);

				// Monitor activation progress
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
