import { Injectable } from '@angular/core';

@Injectable()
export class GoogleMapsLoaderService {
	/**
	 * Loads the Google Maps API.
	 * @param apiKey The Google Maps API key.
	 * @returns A promise that resolves when the API is loaded.
	 */
	load(apiKey: string) {
		const src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing&callback=__onGoogleLoaded`;
		return new Promise(async (resolve, reject) => {
			window['__onGoogleLoaded'] = (ev) => {
				resolve('google maps api loaded');
			};
			const script = document.createElement('script');
			script.src = src;
			script.async = true;
			script.defer = true;
			script.type = 'text/javascript';
			document.getElementsByTagName('head')[0].appendChild(script);
		});
	}
}
