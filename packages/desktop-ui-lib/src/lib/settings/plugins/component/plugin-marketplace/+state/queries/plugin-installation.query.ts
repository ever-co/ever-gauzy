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
	// Pending installations
	public readonly pendingInstallations$: Observable<Record<string, IPendingInstallation>> = this.select(
		(state) => state.pendingInstallations
	);

	// Combined loading state (any plugin is loading)
	public readonly isLoading$: Observable<boolean> = this.select((state) => {
		const hasAnyState = (record: Record<string, boolean>) => Object.values(record).some((val) => val);
		return (
			hasAnyState(state.downloading) ||
			hasAnyState(state.installing) ||
			hasAnyState(state.serverInstalling) ||
			hasAnyState(state.completingInstallation) ||
			hasAnyState(state.activating) ||
			hasAnyState(state.uninstalling) ||
			hasAnyState(state.deactivating)
		);
	});

	constructor(readonly pluginInstallationStore: PluginInstallationStore, readonly pluginQuery: PluginQuery) {
		super(pluginInstallationStore);
	}

	// Per-plugin observables
	public downloading$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.downloading[pluginId] ?? false);
	}

	public downloadProgress$(pluginId: string): Observable<number> {
		return this.select((state) => state.downloadProgress[pluginId] ?? 0);
	}

	public installing$(pluginId?: string): Observable<boolean> {
		return this.select((state) => {
			if (!pluginId) {
				return Object.values(state.installing).some((val) => val);
			}
			return state.installing[pluginId] ?? false;
		});
	}

	public serverInstalling$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.serverInstalling[pluginId] ?? false);
	}

	public completingInstallation$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.completingInstallation[pluginId] ?? false);
	}

	public activating$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.activating[pluginId] ?? false);
	}

	public uninstalling$(pluginId?: string): Observable<boolean> {
		return this.select((state) => {
			if (!pluginId) {
				return Object.values(state.uninstalling).some((val) => val);
			}
			return state.uninstalling[pluginId] ?? false;
		});
	}

	public deactivating$(pluginId: string): Observable<boolean> {
		return this.select((state) => state.deactivating[pluginId] ?? false);
	}

	public error$(pluginId: string): Observable<string | null> {
		return this.select((state) => state.error[pluginId] ?? null);
	}

	public isPluginLoading$(pluginId: string): Observable<boolean> {
		return this.select(
			(state) =>
				state.downloading[pluginId] ||
				state.installing[pluginId] ||
				state.serverInstalling[pluginId] ||
				state.completingInstallation[pluginId] ||
				state.activating[pluginId] ||
				state.uninstalling[pluginId] ||
				state.deactivating[pluginId] ||
				false
		);
	}

	public installed$(pluginId: ID): Observable<boolean> {
		return this.pluginQuery.plugins$.pipe(
			map((plugins: IPlugin[]) => {
				return plugins.some((p) => p.marketplaceId === pluginId);
			})
		);
	}

	public installationId$(pluginId: ID): Observable<ID | null> {
		return this.pluginQuery.plugins$.pipe(
			map((plugins: IPlugin[]) => {
				const plugin = plugins.find((p) => p.marketplaceId === pluginId);
				return plugin ? plugin.id : null;
			})
		);
	}

	// Synchronous getters
	public get isLoading(): boolean {
		const state = this.getValue();
		const hasAnyState = (record: Record<string, boolean>) => Object.values(record).some((val) => val);
		return (
			hasAnyState(state.downloading) ||
			hasAnyState(state.installing) ||
			hasAnyState(state.serverInstalling) ||
			hasAnyState(state.completingInstallation) ||
			hasAnyState(state.activating) ||
			hasAnyState(state.uninstalling) ||
			hasAnyState(state.deactivating)
		);
	}

	public isPluginLoading(pluginId: string): boolean {
		const state = this.getValue();
		return (
			state.downloading[pluginId] ||
			state.installing[pluginId] ||
			state.serverInstalling[pluginId] ||
			state.completingInstallation[pluginId] ||
			state.activating[pluginId] ||
			state.uninstalling[pluginId] ||
			state.deactivating[pluginId] ||
			false
		);
	}

	public getPendingInstallation(pluginId: string): IPendingInstallation | null {
		return this.getValue().pendingInstallations[pluginId] || null;
	}

	public hasError(pluginId?: string): boolean {
		const state = this.getValue();
		if (pluginId) {
			return !!state.error[pluginId];
		}
		return Object.keys(state.error).length > 0;
	}

	public getError(pluginId: string): string | null {
		return this.getValue().error[pluginId] || null;
	}
}
