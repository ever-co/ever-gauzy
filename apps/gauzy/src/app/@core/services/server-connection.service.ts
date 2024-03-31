import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from './store.service';

@Injectable()
export class ServerConnectionService {
	constructor(private readonly httpClient: HttpClient, private readonly store: Store) {}

	async checkServerConnection(endPoint: string) {
		const url = `${endPoint}/api`;

		return new Promise((resolve, reject) => {
			console.log(`Checking server connection on URL in ServerConnectionService in @core/services: ${url}`);

			try {
				if (endPoint !== 'http://localhost:3000') {
					const requestObservable = this.httpClient.get(url);

					if (!requestObservable) {
						console.error('Failed to create an Observable from the HTTP request.');
						reject('Failed to create an Observable from the HTTP request.');
						return;
					}

					requestObservable.subscribe({
						next: (resp: any) => {
							console.log(
								`Server connection status in ServerConnectionService for URL ${url} is: ${resp.status}`
							);
							this.store.serverConnection = resp.status;
							resolve(true);
						},
						error: (err) => {
							console.error(
								`Error checking server connection in ServerConnectionService for URL ${url}`,
								err
							);
							this.store.serverConnection = err.status;
							reject(err);
						}
					});
				} else {
					console.log(`Skip checking server connection for URL ${url}`);
					this.store.serverConnection = 200;
					resolve(true);
				}
			} catch (error) {
				console.error(`Error checking server connection in ServerConnectionService for URL ${url}`, error);
				this.store.serverConnection = 500;
				reject(error);
			}
		});
	}
}
