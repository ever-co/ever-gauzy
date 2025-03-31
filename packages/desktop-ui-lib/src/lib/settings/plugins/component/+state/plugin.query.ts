import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IPluginState, PluginStore } from './plugin.store';
import { IPlugin } from '../../services/plugin-loader.service';

@Injectable({ providedIn: 'root' })
export class PluginQuery extends Query<IPluginState> {
	public readonly plugins$: Observable<IPlugin[]> = this.select((state) => state.plugins);
	public readonly plugin$: Observable<IPlugin> = this.select((state) => state.plugin);
	public readonly installing$: Observable<boolean> = this.select((state) => state.installing);
	public readonly uninstalling$: Observable<boolean> = this.select((state) => state.uninstalling);
	public readonly activating$: Observable<boolean> = this.select((state) => state.activating);
	public readonly deactivating$: Observable<boolean> = this.select((state) => state.deactivating);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(readonly pluginStore: PluginStore) {
		super(pluginStore);
	}

	public get plugin(): IPlugin {
		return this.getValue().plugin;
	}

	public get plugins(): IPlugin[] {
		return this.getValue().plugins || [];
	}

	public get installing(): boolean {
		return this.getValue().installing;
	}

	public get uninstalling(): boolean {
		return this.getValue().uninstalling;
	}

	public get activating(): boolean {
		return this.getValue().activating;
	}

	public get deactivating(): boolean {
		return this.getValue().deactivating;
	}
}
