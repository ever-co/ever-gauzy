import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';

import { IPluginInstallationState, PluginInstallationStore } from '../stores/plugin-installation.store';
import { IPlugin } from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class PluginInstallationQuery extends Query<IPluginInstallationState> {
	public readonly installing$: Observable<boolean> = this.select((state) => state.installing);
	public readonly uninstalling$: Observable<boolean> = this.select((state) => state.uninstalling);
	public readonly activating$: Observable<boolean> = this.select((state) => state.activating);
	public readonly deactivating$: Observable<boolean> = this.select((state) => state.deactivating);
	public readonly toggle$: Observable<IPluginInstallationState['toggle']> = this.select((state) => state.toggle);

	constructor(readonly pluginInstallationStore: PluginInstallationStore) {
		super(pluginInstallationStore);
	}

	public get plugin(): IPlugin {
		return this.getValue().toggle.plugin;
	}

	public get checked(): boolean {
		return this.getValue().toggle.isChecked;
	}
}
