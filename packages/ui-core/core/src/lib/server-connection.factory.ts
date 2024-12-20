import { Router } from "@angular/router";
import { environment } from "@gauzy/ui-config";
import { Store } from "./services/store";
import { ServerConnectionService } from "./services/server-connection";

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
	router: Router
): () => Promise<void> {
	return async () => {
		const url = environment.API_BASE_URL;

		console.log(`Checking server connection in serverConnectionFactory on URL: ${url}`);

		try {
			// Attempt to check server connection
			await provider.checkServerConnection(url);

			console.log(
				`Server connection status in serverConnectionFactory for URL: ${url} is: ${store.serverConnection}`
			);

			// Navigate to 'server-down' page if the connection is unsuccessful
			if (store.serverConnection !== 200) {
				router.navigate(['server-down']);
			}
		} catch (err) {
			console.error(
				`Error checking server connection in serverConnectionFactory for URL: ${url}`,
				err
			);
		}
	};
}
