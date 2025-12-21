import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PluginService } from '../../services/plugin.service';
import { IInstallationCommand } from '../interfaces';

/**
 * Parameters for server installation command
 */
export interface IServerInstallCommandParams {
	pluginId: string;
	versionId: string;
	installationId?: string;
}

/**
 * Result of server installation command
 */
export interface IServerInstallCommandResult {
	installationId: string;
	message?: string;
}

/**
 * Command for installing a plugin on the server
 * Following Command Pattern - encapsulates server-side installation
 * Following Single Responsibility Principle - only handles server installation
 */
@Injectable({
	providedIn: 'root'
})
export class ServerInstallPluginCommand
	implements IInstallationCommand<IServerInstallCommandParams, IServerInstallCommandResult>
{
	constructor(private readonly pluginService: PluginService) {}

	/**
	 * Executes the server installation command
	 */
	public execute(params: IServerInstallCommandParams): Observable<IServerInstallCommandResult> {
		const { pluginId, versionId } = params;

		return this.pluginService.install({ pluginId, versionId }).pipe(
			map((response) => ({
				installationId: response.id,
				message: 'Server installation initiated'
			}))
		);
	}

	/**
	 * Rollback server installation
	 */
	public undo(params: IServerInstallCommandParams): Observable<void> {
		return this.pluginService.uninstall(
			params.pluginId,
			params.installationId,
			'Uninstall after failed installation'
		);
	}
}
