import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from './store.service';

@Injectable()
export class ServerConnectionService {
	constructor(private readonly httpClient: HttpClient, private readonly store: Store) {}

	async checkServerConnection(endPoint: string) {
		const url = `${endPoint}/api`;

		return new Promise((resolve, reject) => {
			console.log(`Checking server connection in ServerConnectionService in desktop-ui-lib on URL: ${url}`);

			if (endPoint !== 'http://localhost:3800') {
				try {
					const requestObservable = this.httpClient.get(url);

					if (!requestObservable) {
						console.error('Failed to create an Observable from the HTTP request.');
						reject('Failed to create an Observable from the HTTP request.');
						return;
					}

					requestObservable.subscribe({
						next: (resp: any) => {
							if (resp) {
								this.store.serverConnection = resp.status;
								console.log(
									`Server connection status in ServerConnectionService in desktop-ui-lib for URL: ${url} is: `,
									resp.status
								);
								resolve(true);
							} else {
								console.log('Server connection resp empty');
								resolve(false);
							}
						},
						error: (err) => {
							console.error(
								`Error checking server connection in ServerConnectionService for URL: ${url}`,
								err
							);

							if (this.store.userId) {
								console.log(
									`We were unable to connect to the server, but we have a user id ${this.store.userId}.`
								);
								resolve(true);
							} else {
								this.store.serverConnection = err.status;
								reject(err);
							}
						}
					});
				} catch (error) {
					console.error(`Error checking server connection in ServerConnectionService for URL: ${url}`, error);
					reject(error);
				}
			} else {
				console.log(`Skip checking server connection for URL: ${url}`);
				resolve(true);
			}
		});
	}
}
