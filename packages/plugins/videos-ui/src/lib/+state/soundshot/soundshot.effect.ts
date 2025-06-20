import { Injectable } from '@angular/core';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, finalize, switchMap, tap } from 'rxjs';
import { SoundshotStore } from './soundshot.store';
import { SoundshotService } from '../../shared/services/soundshot.service';
import { SoundshotAction } from './soundshot.action';
import { DownloadQueueService } from '../../shared/services/download/download-queue.service';

@Injectable({ providedIn: 'root' })
export class SoundshotEffects {
	constructor(
		private readonly action$: Actions,
		private readonly soundshotStore: SoundshotStore,
		private readonly soundshotService: SoundshotService,
		private readonly downloadQueueService: DownloadQueueService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService
	) { }

	public fetchAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(SoundshotAction.fetchAll),
			tap(() => this.soundshotStore.setLoading(true)), // Start loading state
			switchMap(({ params = {} }) =>
				this.soundshotService.getAll(params).pipe(
					tap(({ items, total }) =>
						this.soundshotStore.update((state) => ({
							soundshots: [
								...new Map([...state.soundshots, ...items].map((item) => [item.id, item])).values()
							],
							count: total
						}))
					),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						return EMPTY; // Return a fallback observable
					}),
					finalize(() => this.soundshotStore.setLoading(false)) // Always stop loading
				)
			)
		)
	);

	public fetchOne$ = createEffect(() =>
		this.action$.pipe(
			ofType(SoundshotAction.fetchOne),
			tap(() => this.soundshotStore.setLoading(true)), // Start loading state
			switchMap(({ id, params = {} }) =>
				this.soundshotService.getOne(id, params).pipe(
					tap((soundshot) => this.soundshotStore.update({ soundshot })),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						return EMPTY; // Return a fallback observable
					}),
					finalize(() => this.soundshotStore.setLoading(false)) // Always stop loading
				)
			)
		)
	);

	public restore$ = createEffect(() =>
		this.action$.pipe(
			ofType(SoundshotAction.restore),
			tap(() => {
				this.soundshotStore.update({ restoring: true });
				this.toastrService.info('Restoring soundshot...', 'Restore');
			}),
			switchMap(({ id }) => {
				return this.soundshotService.restore(id).pipe(
					tap(() => {
						this.updateStoreAfterRestore(id);
						this.toastrService.success('Soundshot restored successfully', 'Restore');
					}),
					finalize(() => this.soundshotStore.update({ restoring: false })),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						this.toastrService.error('Failed to restore soundshot', 'Restore Error');
						return EMPTY; // Return a fallback observable
					})
				);
			})
		)
	);

	public delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(SoundshotAction.delete, SoundshotAction.hardDelete),
			tap(() => {
				this.soundshotStore.update({ deleting: true });
				this.toastrService.info('Deleting soundshot...', 'Delete');
			}),
			switchMap(({ id, params = {} }) => {
				return this.soundshotService.delete(id, params).pipe(
					tap(() => {
						this.updateStoreAfterDelete(id, params);
						this.toastrService.success('Soundshot deleted successfully', 'Delete');
					}),
					finalize(() => this.soundshotStore.update({ deleting: false })),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						this.toastrService.error('Failed to delete soundshot', 'Delete Error');
						return EMPTY; // Return a fallback observable
					})
				);
			})
		)
	);

	addToQueue$ = createEffect(() =>
		this.action$.pipe(
			ofType(SoundshotAction.download),
			tap(({ urls }) => {
				const isAdded = this.downloadQueueService.add(urls);
				if (isAdded) {
					this.toastrService.info('soundshot added to queue', 'Download Soundshot');
				} else {
					this.toastrService.error('Failed to add soundshot to queue', 'Download Error');
				}
			})
		)
	);

	private updateStoreAfterRestore(id: string) {
		this.soundshotStore.update((state) => {
			const { soundshots, soundshot } = state;

			// Update soundshots array - restore matching item
			const updatedSoundshots = soundshots.map((c) => (c.id === id ? { ...c, deletedAt: null } : c));

			// Update selected soundshot if it matches the restored ID
			const updatedSoundshot = soundshot?.id === id ? { ...soundshot, deletedAt: null } : soundshot;

			return {
				soundshots: updatedSoundshots,
				soundshot: updatedSoundshot
			};
		});
	}

	private updateStoreAfterDelete(id: string, params: { forceDelete?: boolean }) {
		this.soundshotStore.update((state) => {
			const { soundshots, soundshot } = state;
			const shouldRemove = params.forceDelete ?? false;
			const now = new Date();

			// Update soundshots array
			const updatedSoundshots = shouldRemove
				? soundshots.filter((c) => c.id !== id)
				: soundshots.map((c) => (c.id === id ? { ...c, deletedAt: now } : c));

			// Update selected soundshot
			const updatedSelectedSoundshot =
				soundshot?.id !== id ? soundshot : shouldRemove ? null : { ...soundshot, deletedAt: now };

			return {
				soundshots: updatedSoundshots,
				soundshot: updatedSelectedSoundshot
			};
		});
	}
}
