import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { tap } from 'rxjs';
import { PluginToggleActions } from '../actions/plugin-toggle.action';
import { PluginToggleStore } from '../stores/plugin-toggle.store';

@Injectable({ providedIn: 'root' })
export class PluginToggleEffects {
	constructor(private readonly action$: Actions, private readonly pluginToggleStore: PluginToggleStore) {}

	public toggle$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginToggleActions.toggle),
			tap(({ pluginId, enabled }) => this.pluginToggleStore.setToggle(pluginId, enabled))
		)
	);

	public auto$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginToggleActions.auto),
			tap(({ pluginId }) => this.pluginToggleStore.setAutoToggle(pluginId))
		)
	);
}
