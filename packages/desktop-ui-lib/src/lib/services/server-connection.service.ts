import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from './store.service';

@Injectable()
export class ServerConnectionService {
	constructor(
		private readonly httpClient: HttpClient,
		private readonly store: Store
	) {}

	async checkServerConnection(endPoint: string) {
		return new Promise((resolve, reject) => {
			this.httpClient.get(`${endPoint}/api`).subscribe({
				next: (resp: any) => {
					this.store.serverConnection = resp.status;
					resolve(true);
				},
				error: (err) => {
					if (this.store.userId) {
						resolve(true);
					}
					this.store.serverConnection = err.status;
					reject(err);
				},
			});
		}).catch((e) => {});
	}
}
