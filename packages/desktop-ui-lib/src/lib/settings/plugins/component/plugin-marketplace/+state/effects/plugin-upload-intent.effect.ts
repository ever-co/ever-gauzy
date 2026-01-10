import { inject, Injectable } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { asyncScheduler, EMPTY, exhaustMap, filter, map, of, switchMap, take, tap } from 'rxjs';
import { AddPluginComponent } from '../../../add-plugin/add-plugin.component';
import { UploadSelectionComponent } from '../../../upload-selection/upload-selection.component';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginUploadIntentActions } from '../actions/plugin-upload-intent.action';
import { PluginUploadIntentStore, UploadIntent } from '../stores/plugin-upload-intent.store';

@Injectable({ providedIn: 'root' })
export class PluginUploadIntentEffects {
	private readonly action$ = inject(Actions);
	private readonly dialogService = inject(NbDialogService);
	private readonly uploadIntentStore = inject(PluginUploadIntentStore);

	/**
	 * Effect to handle opening the upload selection modal
	 * Opens modal, waits for user selection, stores intent, and dispatches appropriate action
	 */
	openUploadSelection$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginUploadIntentActions.openUploadSelection),
				exhaustMap(() =>
					this.dialogService
						.open(UploadSelectionComponent, {
							backdropClass: 'backdrop-blur',
							closeOnEsc: true
						})
						.onClose.pipe(
							take(1),
							filter(Boolean),
							switchMap((intent: UploadIntent) => {
								// Store the intent in Akita
								this.uploadIntentStore.setIntent(intent);

								// Route based on the user's selection
								if (intent === UploadIntent.Install) {
									// Open AddPluginComponent which has Local, CDN, and NPM options
									return this.dialogService
										.open(AddPluginComponent, {
											backdropClass: 'backdrop-blur'
										})
										.onClose.pipe(
											take(1),
											map(() => PluginUploadIntentActions.clearUploadIntent())
										);
								} else if (intent === UploadIntent.Publish) {
									// Dispatch action to trigger marketplace publish flow
									return of(PluginMarketplaceActions.upload());
								}
								return EMPTY;
							})
						)
				)
			),
		{ dispatch: true }
	);

	onClearIntent$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginUploadIntentActions.clearUploadIntent, PluginMarketplaceActions.upload),
				tap(() => asyncScheduler.schedule(() => this.uploadIntentStore.clearIntent(), 100))
			),
		{ dispatch: false }
	);
}
