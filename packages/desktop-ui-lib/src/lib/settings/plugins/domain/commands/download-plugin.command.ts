import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { IInstallationCommand } from '../interfaces';

/**
 * Parameters for download command
 */
export interface IDownloadCommandParams<T = any> {
	config: T;
}

/**
 * Result of download command
 */
export interface IDownloadCommandResult {
	plugin: IPlugin;
	message?: string;
}

/**
 * Command for downloading a plugin
 * Following Command Pattern - encapsulates download action
 * Following Single Responsibility Principle - only handles download
 */
@Injectable({
	providedIn: 'root'
})
export class DownloadPluginCommand implements IInstallationCommand<IDownloadCommandParams, IDownloadCommandResult> {
	constructor(private readonly pluginElectronService: PluginElectronService) {}

	/**
	 * Executes the download command
	 */
	public execute<T>(params: IDownloadCommandParams<T>): Observable<IDownloadCommandResult> {
		const { config } = params;

		// Trigger download
		this.pluginElectronService.downloadAndInstall(config);

		// Monitor progress and return result
		return this.pluginElectronService.progress<void, IPlugin>().pipe(
			map(({ data, message }) => ({
				plugin: data,
				message
			}))
		);
	}
}
