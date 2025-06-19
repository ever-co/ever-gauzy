import { Injectable } from '@angular/core';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, finalize, switchMap, tap } from 'rxjs';
import { CamshotStore } from './camshot.store';
import { CamshotService } from '../../shared/services/camshot.service';
import { CamshotAction } from './camshot.action';
import { DownloadQueueService } from '../../shared/services/download/download-queue.service';

@Injectable({ providedIn: 'root' })
export class CamshotEffects {
	constructor(
		private readonly action$: Actions,
		private readonly camshotStore: CamshotStore,
		private readonly camshotService: CamshotService,
		private readonly downloadQueueService: DownloadQueueService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService
	) { }

	public fetchCamshots$ = createEffect(() =>
		this.action$.pipe(
			ofType(CamshotAction.fetchCamshots),
			tap(() => this.camshotStore.setLoading(true)), // Start loading state
			switchMap(({ params = {} }) =>
				this.camshotService.getAll(params).pipe(
					tap(({ items, total }) =>
						this.camshotStore.update((state) => ({
							camshots: [
								...new Map([...state.camshots, ...items].map((item) => [item.id, item])).values()
							],
							count: total
						}))
					),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						return EMPTY; // Return a fallback observable
					}),
					finalize(() => this.camshotStore.setLoading(false)) // Always stop loading
				)
			)
		)
	);

	public fetchOneCamshot$ = createEffect(() =>
		this.action$.pipe(
			ofType(CamshotAction.fetchOneCamshot),
			tap(() => this.camshotStore.setLoading(true)), // Start loading state
			switchMap(({ id, params = {} }) =>
				this.camshotService.getOne(id, params).pipe(
					tap((camshot) => this.camshotStore.update({ camshot })),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						return EMPTY; // Return a fallback observable
					}),
					finalize(() => this.camshotStore.setLoading(false)) // Always stop loading
				)
			)
		)
	);

	public restore$ = createEffect(() =>
		this.action$.pipe(
			ofType(CamshotAction.restoreCamshot),
			tap(() => {
				this.camshotStore.update({ restoring: true });
				this.toastrService.info('Restoring camshot...', 'Restore');
			}),
			switchMap(({ id }) => {
				return this.camshotService.restore(id).pipe(
					tap(() => {
						this.updateStoreAfterRestore(id);
						this.toastrService.success('Camshot restored successfully', 'Restore');
					}),
					finalize(() => this.camshotStore.update({ restoring: false })),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						this.toastrService.error('Failed to restore camshot', 'Restore Error');
						return EMPTY; // Return a fallback observable
					})
				);
			})
		)
	);

	public delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(CamshotAction.deleteCamshot, CamshotAction.hardDeleteCamshot),
			tap(() => {
				this.camshotStore.update({ deleting: true });
				this.toastrService.info('Deleting camshot...', 'Delete');
			}),
			switchMap(({ id, params = {} }) => {
				return this.camshotService.delete(id, params).pipe(
					tap(() => {
						this.updateStoreAfterDelete(id, params);
						this.toastrService.success('Camshot deleted successfully', 'Delete');
					}),
					finalize(() => this.camshotStore.update({ deleting: false })),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						this.toastrService.error('Failed to delete camshot', 'Delete Error');
						return EMPTY; // Return a fallback observable
					})
				);
			})
		)
	);

	addToQueue$ = createEffect(() =>
		this.action$.pipe(
			ofType(CamshotAction.downloadCamshot),
			tap(({ url }) => {
				const isAdded = this.downloadQueueService.add([url]);
				if (isAdded) {
					this.toastrService.info('Camshot added to queue', 'Download Camshot');
				}
			})
		)
	);

	private updateStoreAfterRestore(id: string) {
		this.camshotStore.update((state) => {
			const { camshots, camshot } = state;

			// Update camshots array - restore matching item
			const updatedCamshots = camshots.map((c) => (c.id === id ? { ...c, deletedAt: null } : c));

			// Update selected camshot if it matches the restored ID
			const updatedCamshot = camshot?.id === id ? { ...camshot, deletedAt: null } : camshot;

			return {
				camshots: updatedCamshots,
				camshot: updatedCamshot
			};
		});
	}

	private updateStoreAfterDelete(id: string, params: { forceDelete?: boolean }) {
		this.camshotStore.update((state) => {
			const { camshots, camshot } = state;
			const shouldRemove = params.forceDelete ?? false;
			const now = new Date();

			// Update camshots array
			const updatedCamshots = shouldRemove
				? camshots.filter((c) => c.id !== id)
				: camshots.map((c) => (c.id === id ? { ...c, deletedAt: now } : c));

			// Update selected camshot
			const updatedSelectedCamshot =
				camshot?.id !== id ? camshot : shouldRemove ? null : { ...camshot, deletedAt: now };

			return {
				camshots: updatedCamshots,
				camshot: updatedSelectedCamshot
			};
		});
	}
}
