import { Injectable } from '@angular/core';
import { ErrorHandlingService } from '@gauzy/ui-core/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, finalize, switchMap, tap } from 'rxjs';
import { CamshotStore } from './camshot.store';
import { CamshotService } from '../../shared/services/camshot.service';
import { CamshotAction } from './camshot.action';

@Injectable({ providedIn: 'root' })
export class CamshotEffects {
	constructor(
		private readonly action$: Actions,
		private readonly camshotStore: CamshotStore,
		private readonly camshotService: CamshotService,
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
}
