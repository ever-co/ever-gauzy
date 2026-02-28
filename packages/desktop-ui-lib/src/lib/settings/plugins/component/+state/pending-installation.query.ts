import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { map, Observable } from 'rxjs';
import {
	IPendingInstallationState,
	IPendingPagination,
	IPendingPluginInstallation,
	PendingInstallationStore
} from './pending-installation.store';

@Injectable({ providedIn: 'root' })
export class PendingInstallationQuery extends Query<IPendingInstallationState> {
	/** Observable of all pending plugins */
	public readonly pendingPlugins$: Observable<IPendingPluginInstallation[]> = this.select(
		(state) => state.pendingPlugins
	);

	/** Observable of loading state */
	public readonly loading$: Observable<boolean> = this.select((state) => state.loading);

	/** Observable of global error state */
	public readonly error$: Observable<string | null> = this.select((state) => state.error);

	/** Observable of whether the check has been performed */
	public readonly checked$: Observable<boolean> = this.select((state) => state.checked);

	/** Observable of force install enabled state */
	public readonly forceInstallEnabled$: Observable<boolean> = this.select((state) => state.forceInstallEnabled);

	/** Observable of pending plugins count */
	public readonly pendingCount$: Observable<number> = this.pendingPlugins$.pipe(map((plugins) => plugins.length));

	/** Observable indicating if there are pending plugins */
	public readonly hasPendingPlugins$: Observable<boolean> = this.pendingCount$.pipe(map((count) => count > 0));

	/** Observable of any plugin currently installing */
	public readonly isAnyInstalling$: Observable<boolean> = this.pendingPlugins$.pipe(
		map((plugins) => plugins.some((p) => p.isInstalling))
	);

	/** Observable of plugins that can be auto-installed */
	public readonly autoInstallablePlugins$: Observable<IPendingPluginInstallation[]> = this.pendingPlugins$.pipe(
		map((plugins) => plugins.filter((p) => p.canAutoInstall === true))
	);

	/** Observable of mandatory plugins */
	public readonly mandatoryPlugins$: Observable<IPendingPluginInstallation[]> = this.pendingPlugins$.pipe(
		map((plugins) => plugins.filter((p) => p.isMandatory === true))
	);

	/** Observable indicating if there are auto-installable plugins */
	public readonly hasAutoInstallablePlugins$: Observable<boolean> = this.autoInstallablePlugins$.pipe(
		map((plugins) => plugins.length > 0)
	);

	/** Observable indicating if there are mandatory plugins */
	public readonly hasMandatoryPlugins$: Observable<boolean> = this.mandatoryPlugins$.pipe(
		map((plugins) => plugins.length > 0)
	);

	public readonly pagination$: Observable<IPendingPagination> = this.select((state) => state.pagination);

	constructor(readonly store: PendingInstallationStore) {
		super(store);
	}

	public get hasNext$(): Observable<boolean> {
		return this.select((state) => this._hasNext(state.pagination));
	}

	public get hasNext(): boolean {
		return this._hasNext(this.getValue().pagination);
	}

	private _hasNext(pagination: IPendingPagination): boolean {
		const { skip, take, total } = pagination;
		return skip * take < total;
	}

	/**
	 * Gets the current pending plugins count
	 */
	public get pendingCount(): number {
		return this.getValue().pendingPlugins.length;
	}

	/**
	 * Gets whether there are pending plugins
	 */
	public get hasPendingPlugins(): boolean {
		return this.pendingCount > 0;
	}

	/**
	 * Gets whether the check has been performed
	 */
	public get checked(): boolean {
		return this.getValue().checked;
	}

	/**
	 * Gets a specific plugin's installing state
	 */
	public isPluginInstalling$(pluginId: string): Observable<boolean> {
		return this.pendingPlugins$.pipe(
			map((plugins) => plugins.find((p) => p.plugin.id === pluginId)?.isInstalling ?? false)
		);
	}

	/**
	 * Gets a specific plugin's error state
	 */
	public getPluginError$(pluginId: string): Observable<string | null> {
		return this.pendingPlugins$.pipe(
			map((plugins) => plugins.find((p) => p.plugin.id === pluginId)?.error ?? null)
		);
	}

	/**
	 * Gets whether force install mode is enabled
	 */
	public get forceInstallEnabled(): boolean {
		return this.getValue().forceInstallEnabled;
	}

	/**
	 * Gets auto-installable plugins (synchronous)
	 */
	public get autoInstallablePlugins(): IPendingPluginInstallation[] {
		return this.getValue().pendingPlugins.filter((p) => p.canAutoInstall === true);
	}

	/**
	 * Gets mandatory plugins (synchronous)
	 */
	public get mandatoryPlugins(): IPendingPluginInstallation[] {
		return this.getValue().pendingPlugins.filter((p) => p.isMandatory === true);
	}
}
