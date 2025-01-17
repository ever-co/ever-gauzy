import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { switchMap, tap, filter, catchError, of, finalize, EMPTY } from 'rxjs';
import { VideoService } from '../shared/services/video.service';
import { VideoActions } from './video.action';
import { VideoStore } from './video.store';
import { VideoQuery } from './video.query';
import { ErrorHandlingService } from '@gauzy/ui-core/core';

@Injectable({ providedIn: 'root' })
export class VideoEffects {
	constructor(
		private readonly action$: Actions,
		private readonly videoStore: VideoStore,
		private readonly videoQuery: VideoQuery,
		private readonly videoService: VideoService,
		private readonly errorHandler: ErrorHandlingService
	) {}

	fetchVideos$ = createEffect(() =>
		this.action$.pipe(
			ofType(VideoActions.fetchVideos),
			tap(() => this.videoStore.setLoading(true)), // Start loading state
			switchMap(({ params = {} }) =>
				this.videoService.getAll(params).pipe(
					tap(({ items, total }) =>
						this.videoStore.update({
							videos: items,
							count: total
						})
					),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle error properly
						return EMPTY; // Return a fallback observable
					}),
					finalize(() => this.videoStore.setLoading(false)) // Always stop loading
				)
			)
		)
	);

	fetchOneVideo$ = createEffect(() =>
		this.action$.pipe(
			ofType(VideoActions.fetchOneVideo),
			tap(() => this.videoStore.setLoading(true)), // Start loading state
			switchMap(({ id, params = {} }) =>
				this.videoService.getOne(id, params).pipe(
					filter(Boolean), // Filter out null or undefined responses
					tap((video) =>
						this.videoStore.update({
							video
						})
					),
					catchError((error) => {
						this.errorHandler.handleError(error); // Handle the error
						return EMPTY; // Return a fallback value to keep the stream alive
					}),
					finalize(() => this.videoStore.setLoading(false)) // Always stop loading
				)
			)
		)
	);

	updateVideo$ = createEffect(() =>
		this.action$.pipe(
			ofType(VideoActions.updateVideo),
			switchMap(({ id, video }) =>
				this.videoService.update(id, video).pipe(
					tap((video) => {
						const videos = this.videoQuery.videos;
						this.videoStore.update({
							videos: [...new Map([...videos, video].map((item) => [item.id, item])).values()]
						});
					}),
					catchError((error) => of(this.errorHandler.handleError(error)))
				)
			)
		)
	);

	deleteVideo$ = createEffect(() =>
		this.action$.pipe(
			ofType(VideoActions.deleteVideo),
			switchMap(({ id }) =>
				this.videoService.delete(id).pipe(
					tap(() => {
						const videos = this.videoQuery.videos;
						this.videoStore.update({
							videos: videos.filter((video) => video.id !== id)
						});
					}),
					catchError((error) => of(this.errorHandler.handleError(error)))
				)
			)
		)
	);
}
