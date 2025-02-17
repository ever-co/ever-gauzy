import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable } from 'rxjs';
import { VideoService } from '../video.service';

/**
 * VideoAvailabilityResolver is a resolver function that checks the availability of a video.
 * It uses the VideoService to determine if a video is available.
 *
 * @returns {Observable<boolean>} - An observable that emits a boolean indicating
 * whether the video is available or not.
 */

export const VideoAvailabilityResolver: ResolveFn<Observable<boolean>> = (): Observable<boolean> => {
	// Inject the VideoService
	const videoService = inject(VideoService);
	// Call the isAvailable$ method
	return videoService.isAvailable$;
};
