import { Injectable } from '@angular/core';

@Injectable()
export class GoogleMapsLoaderService {
	constructor() {}

	load(googleMapsApiKey: string) {
		const src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,drawing&callback=__onGoogleLoaded`;
		return new Promise(async (resolve, reject) => {
			window['__onGoogleLoaded'] = (ev) => {
				resolve('google maps api loaded');
			};
			const node = document.createElement('script');
			node.src = src;
			node.type = 'text/javascript';
			document.getElementsByTagName('head')[0].appendChild(node);
		});
	}
}
