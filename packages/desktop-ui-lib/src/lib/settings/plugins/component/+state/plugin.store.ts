import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin } from '../../services/plugin-loader.service';

export interface IPluginState {
	activating: boolean;
	deactivating: boolean;
	plugins: IPlugin[];
	plugin: IPlugin;
}

export function createInitialState(): IPluginState {
	return {
		activating: false,
		deactivating: false,
		plugins: [],
		plugin: null
	};
}

@StoreConfig({ name: '_plugins' })
@Injectable({ providedIn: 'root' })
export class PluginStore extends Store<IPluginState> {
	constructor() {
		super(createInitialState());
	}
}
