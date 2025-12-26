import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';

import { ID, IPluginVersion } from '@gauzy/contracts';
import { IPluginVersionState, PluginVersionStore } from '../stores/plugin-version.store';

@Injectable({ providedIn: 'root' })
export class PluginVersionQuery extends Query<IPluginVersionState> {
	public readonly versions$: Observable<IPluginVersion[]> = this.select((state) => state.versions);
	public readonly version$: Observable<IPluginVersion> = this.select((state) => state.version);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly pluginId$: Observable<ID> = this.select((state) => state.pluginId);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(readonly pluginVersionStore: PluginVersionStore) {
		super(pluginVersionStore);
	}

	// Per-plugin observables
	public deleting$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.deleting[pluginId] ?? false);
	}

	public updating$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.updating[pluginId] ?? false);
	}

	public restoring$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.restoring[pluginId] ?? false);
	}

	public creating$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.creating[pluginId] ?? false);
	}

	public get version(): IPluginVersion {
		return this.getValue().version;
	}

	public get versions(): IPluginVersion[] {
		return this.getValue().versions || [];
	}

	public get count(): number {
		return this.getValue().count;
	}

	public get pluginId(): ID {
		return this.getValue().pluginId;
	}

	public isCreating(pluginId: string): boolean {
		return this.getValue().creating[pluginId] ?? false;
	}

	public isUpdating(pluginId: string): boolean {
		return this.getValue().updating[pluginId] ?? false;
	}

	public isDeleting(pluginId: string): boolean {
		return this.getValue().deleting[pluginId] ?? false;
	}

	public isRestoring(pluginId: string): boolean {
		return this.getValue().restoring[pluginId] ?? false;
	}
}
