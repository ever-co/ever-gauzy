import { Injectable } from '@angular/core';

@Injectable()
export class GoogleMapsLoaderService {
	/**
	 * Loads the Google Maps API.
	 * @param apiKey The Google Maps API key.
	 * @returns A promise that resolves when the API is loaded.
	 */
	load(apiKey: string): Promise<string> {
		const src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing&callback=__onGoogleLoaded`;

		return new Promise((resolve, reject) => {
			// Prevent loading multiple times
			if (document.querySelector(`script[src^="https://maps.googleapis.com/maps/api/js"]`)) {
				resolve('google maps api already loaded');
				return;
			}

			window['__onGoogleLoaded'] = () => {
				window['__onGoogleLoaded'] = undefined;
				resolve('google maps api loaded');
			};

			const script = document.createElement('script');
			script.src = src;
			script.async = true;
			script.defer = true;
			script.type = 'text/javascript';
			script.onerror = (err) => {
				window['__onGoogleLoaded'] = undefined;
				document.head.removeChild(script);
				reject(new Error('Failed to load Google Maps API'));
			};
			document.head.appendChild(script);
		});
	}
}
