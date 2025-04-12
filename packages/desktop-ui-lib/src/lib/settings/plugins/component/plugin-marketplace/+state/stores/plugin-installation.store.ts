import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin } from '@gauzy/contracts';

export interface IPluginInstallationState {
	installing: boolean;
	uninstalling: boolean;
	activating: boolean;
	deactivating: boolean;
	toggle: {
		isChecked: boolean;
		plugin: IPlugin;
	};
}

export function createInitialInstallationState(): IPluginInstallationState {
	return {
		installing: false,
		uninstalling: false,
		activating: false,
		deactivating: false,
		toggle: {
			isChecked: false,
			plugin: null
		}
	};
}

@StoreConfig({ name: '_plugin_installation' })
@Injectable({ providedIn: 'root' })
export class PluginInstallationStore extends Store<IPluginInstallationState> {
	constructor() {
		super(createInitialInstallationState());
	}

	public setToggle({ isChecked, plugin }: Partial<IPluginInstallationState['toggle']>): void {
		this.update((state) => ({
			...state,
			toggle: {
				...state.toggle,
				isChecked: isChecked ?? state.toggle.isChecked,
				plugin: plugin ?? state.toggle.plugin
			}
		}));
	}
}
