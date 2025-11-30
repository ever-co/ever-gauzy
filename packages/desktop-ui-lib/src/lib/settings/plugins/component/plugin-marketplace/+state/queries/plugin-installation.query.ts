import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { map, Observable } from 'rxjs';

import { ID } from '@gauzy/contracts';
import { PluginQuery } from '../../../+state/plugin.query';
import { IPlugin } from '../../../../services/plugin-loader.service';
import {
	IPendingInstallation,
	IPluginInstallationState,
	PluginInstallationStore
} from '../stores/plugin-installation.store';

@Injectable({ providedIn: 'root' })
export class PluginInstallationQuery extends Query<IPluginInstallationState> {
	// Download observables
	public readonly downloading$: Observable<boolean> = this.select((state) => state.downloading);
	public readonly downloadProgress$: Observable<number> = this.select((state) => state.downloadProgress);

	// Installation observables
	public readonly installing$: Observable<boolean> = this.select((state) => state.installing);
	public readonly serverInstalling$: Observable<boolean> = this.select((state) => state.serverInstalling);
	public readonly completingInstallation$: Observable<boolean> = this.select((state) => state.completingInstallation);

	// Activation observables
	public readonly activating$: Observable<boolean> = this.select((state) => state.activating);

	// Uninstallation observables
	public readonly uninstalling$: Observable<boolean> = this.select((state) => state.uninstalling);
	public readonly deactivating$: Observable<boolean> = this.select((state) => state.deactivating);

	// Current operation observables
	public readonly currentPluginId$: Observable<string> = this.select((state) => state.currentPluginId);
	public readonly currentInstallationId$: Observable<string> = this.select((state) => state.currentInstallationId);

	// Pending installations
	public readonly pendingInstallations$: Observable<Record<string, IPendingInstallation>> = this.select(
		(state) => state.pendingInstallations
	);

	public readonly error$: Observable<string> = this.select((state) => state.error);

	// Combined loading state
	public readonly isLoading$: Observable<boolean> = this.select(
		(state) =>
			state.downloading ||
			state.installing ||
			state.serverInstalling ||
			state.completingInstallation ||
			state.activating ||
			state.uninstalling ||
			state.deactivating
	);

	constructor(readonly pluginInstallationStore: PluginInstallationStore, readonly pluginQuery: PluginQuery) {
		super(pluginInstallationStore);
	}

	public installed$(pluginId: ID): Observable<boolean> {
		return this.pluginQuery.plugins$.pipe(
			map((plugins: IPlugin[]) => {
				return plugins.some((p) => p.marketplaceId === pluginId);
			})
		);
	}

	public get isLoading(): boolean {
		const state = this.getValue();
		return (
			state.downloading ||
			state.installing ||
			state.serverInstalling ||
			state.completingInstallation ||
			state.activating ||
			state.uninstalling ||
			state.deactivating
		);
	}

	public get currentPluginId(): string {
		return this.getValue().currentPluginId;
	}

	public get currentInstallationId(): string {
		return this.getValue().currentInstallationId;
	}

	public getPendingInstallation(pluginId: string): IPendingInstallation | null {
		return this.getValue().pendingInstallations[pluginId] || null;
	}

	public get hasError(): boolean {
		return !!this.getValue().error;
	}

	public get error(): string {
		return this.getValue().error;
	}
}
