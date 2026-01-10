import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export enum UploadIntent {
	Install = 'install',
	Publish = 'publish'
}

export interface IPluginUploadIntentState {
	intent: UploadIntent | null;
}

export function createInitialUploadIntentState(): IPluginUploadIntentState {
	return {
		intent: null
	};
}

@StoreConfig({ name: '_plugin_upload_intent' })
@Injectable({ providedIn: 'root' })
export class PluginUploadIntentStore extends Store<IPluginUploadIntentState> {
	constructor() {
		super(createInitialUploadIntentState());
	}

	/**
	 * Set the upload intent
	 * @param intent - 'install' for local installation, 'publish' for marketplace publishing
	 */
	public setIntent(intent: UploadIntent): void {
		this.update({ intent });
	}

	/**
	 * Clear the upload intent
	 */
	public clearIntent(): void {
		this.update({ intent: null });
	}
}
