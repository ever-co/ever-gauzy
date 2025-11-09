import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { IInstallationCommand } from '../interfaces';

/**
 * Parameters for complete installation command
 */
export interface ICompleteInstallCommandParams {
	marketplaceId: string;
	installationId: string;
}

/**
 * Result of complete installation command
 */
export interface ICompleteInstallCommandResult {
	success: boolean;
	message?: string;
}

/**
 * Command for completing plugin installation
 * Following Command Pattern - encapsulates installation completion
 * Following Single Responsibility Principle - only handles installation completion
 */
@Injectable({
	providedIn: 'root'
})
export class CompleteInstallationCommand
	implements IInstallationCommand<ICompleteInstallCommandParams, ICompleteInstallCommandResult>
{
	constructor(private readonly pluginElectronService: PluginElectronService) {}

	/**
	 * Executes the complete installation command
	 */
	public execute(params: ICompleteInstallCommandParams): Observable<ICompleteInstallCommandResult> {
		const { marketplaceId, installationId } = params;

		this.pluginElectronService.completeInstallation(marketplaceId, installationId);

		// Monitor progress and return result
		return this.pluginElectronService.progress<void, IPlugin>().pipe(
			map(() => ({
				success: true,
				message: 'Installation completed successfully'
			}))
		);
	}
}
