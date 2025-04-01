import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface IPluginInstallationState {
	installing: boolean;
	uninstalling: boolean;
	activating: boolean;
	deactivating: boolean;
}

export function createInitialInstallationState(): IPluginInstallationState {
	return {
		installing: false,
		uninstalling: false,
		activating: false,
		deactivating: false
	};
}

@StoreConfig({ name: '_plugin_installation' })
@Injectable({ providedIn: 'root' })
export class PluginInsatallationStore extends Store<IPluginInstallationState> {
	constructor() {
		super(createInitialInstallationState());
	}
}
