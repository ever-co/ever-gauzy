import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { map, Observable } from 'rxjs';
import { Store } from '../../../../services';

/**
 * VideoAvailabilityResolver is a resolver function that checks the availability of a video.
 * It uses the VideoService to determine if a video is available.
 *
 * @returns {Observable<boolean>} - An observable that emits a boolean indicating
 * whether the video is available or not.
 */
export const PluginUploadResolver: ResolveFn<Observable<boolean>> = (): Observable<boolean> => {
	// Inject the store
	const store = inject(Store);
	// return the isAvailable$
	const isAvailable$ = store.user$.pipe(map((user) => !!user));
	// Call the isAvailable$ method
	return isAvailable$;
};
