import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, finalize, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginService } from '../../../../services/plugin.service';
import { PluginSourceActions } from '../actions/plugin-source.action';
import { PluginSourceStore } from '../stores/plugin-source.store';
import { IPluginSource } from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class PluginSourceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginService: PluginService,
		private readonly pluginSourceStore: PluginSourceStore,
		private readonly toastrService: ToastrNotificationService
	) {}

	getAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.getAll),
			tap(() => this.pluginSourceStore.setLoading(true)), // Start loading state
			switchMap(({ pluginId, versionId, params = {} }) =>
				this.pluginService.getSources(pluginId, versionId, params).pipe(
					tap(({ items, total }) => {
						this.pluginSourceStore.update((state) => {
							if (!items?.length) {
								return {
									sources: state.sources || [],
									source: state.source,
									count: total
								};
							}

							const sourceMap = new Map<string, IPluginSource>(
								(state.sources || []).map((item) => [item.id, item])
							);

							items.forEach((item) => sourceMap.set(item.id, item));

							return {
								sources: Array.from(sourceMap.values()),
								source: state.source ?? items[0],
								count: total
							};
						});
					}),
					finalize(() => this.pluginSourceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);
}
