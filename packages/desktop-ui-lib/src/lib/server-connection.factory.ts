import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { ServerConnectionService } from './services/server-connection.service';
import { Store } from './services/store.service';
import { GAUZY_ENV } from './constants/app.constants';

/**
 * Creates a factory function that checks the server connection and performs actions based on the result.
 *
 * @param {ServerConnectionService} provider - The server connection service instance.
 * @param {Store} store - The store instance.
 * @param {Router} router - The router instance.
 * @returns {() => Promise<void>} A function that checks the server connection and performs actions based on the result.
 */
export function serverConnectionFactory(
	provider: ServerConnectionService,
	store: Store,
	router: Router,
	injector: Injector
): () => Promise<void> {
	// Retrieve environment configuration
	const environment: any = injector.get(GAUZY_ENV);
	const url = environment.API_BASE_URL;

	return async () => {
		try {
			console.log('Checking server connection in serverConnectionFactory on URL:', url);

			// Check server connection
			await provider.checkServerConnection(url);

			console.log(`Server connection status in serverConnectionFactory for URL: ${url} is ${store.serverConnection}`);

			// Navigate to server-down page if the connection is not successful
			// Uncomment the following lines if needed
			// if (store.serverConnection !== 200) {
			//     router.navigate(['server-down']);
			// }
		} catch (err) {
			console.error(
				`Error checking server connection in serverConnectionFactory for URL: ${url}`,
				err
			);
		}
	};
}
