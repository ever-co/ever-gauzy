import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin } from '@gauzy/contracts';

export interface IPluginMarketplaceState {
	updating: boolean;
	deleting: boolean;
	plugins: IPlugin[];
	plugin: IPlugin;
	count: number;
	upload: {
		uploading: boolean;
		progress: number;
	};
}

export function createInitialMarketplaceState(): IPluginMarketplaceState {
	return {
		updating: false,
		deleting: false,
		plugins: [],
		plugin: null,
		count: 0,
		upload: {
			uploading: false,
			progress: 0
		}
	};
}

@StoreConfig({ name: '_marketplace_plugins' })
@Injectable({ providedIn: 'root' })
export class PluginMarketplaceStore extends Store<IPluginMarketplaceState> {
	constructor() {
		super(createInitialMarketplaceState());
	}

	public setUpload(action: Partial<IPluginMarketplaceState['upload']>): void {
		this.update((state) => ({
			...state,
			upload: {
				...state.upload,
				...action
			}
		}));
	}
}
