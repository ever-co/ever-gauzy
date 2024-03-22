import { Injector, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GAUZY_ENV, ServerConnectionService, Store } from '..';
import { Router } from '@angular/router';

@NgModule({
	imports: [CommonModule]
})
export class DesktopUiLibModule {}

export function serverConnectionFactory(
	provider: ServerConnectionService,
	store: Store,
	router: Router,
	injector: Injector
) {
	return () => {
		const environment: any = injector.get(GAUZY_ENV);

		const url = environment.API_BASE_URL;
		console.log('Checking server connection in serverConnectionFactory on URL: ', url);

		return provider
			.checkServerConnection(url)
			.finally(() => {
				console.log(
					`Server connection status in serverConnectionFactory for URL: ${url} is ${store.serverConnection}`
				);
				// if (store.serverConnection !== 200) {
				// 	router.navigate(['server-down']);
				// }
			})
			.catch((err) => {
				console.error(`Error checking server connection in serverConnectionFactory for URL: ${url}`, err);
			});
	};
}
