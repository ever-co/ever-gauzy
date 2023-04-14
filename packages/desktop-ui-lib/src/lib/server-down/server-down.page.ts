import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ServerConnectionService, Store } from '../services';
// @ts-ignore
import { environment } from '@env/environment';

@Component({
	styleUrls: ['./server-down.page.scss'],
	templateUrl: 'server-down.page.html',
})
export class ServerDownPage implements OnInit, OnDestroy {
	noInternetLogo: string;
	interval: any;

	constructor(
		private store: Store,
		private serverConnectionService: ServerConnectionService,
		private readonly router: Router
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
	}

	ngOnInit(): void {
		this.checkConnection();
	}

	private async checkConnection() {
		this.interval = setInterval(async () => {
			await this.serverConnectionService.checkServerConnection(
				environment.API_BASE_URL
			);
			if (
				Number(this.store.serverConnection) === 200 ||
				this.store.userId
			) {
				clearInterval(this.interval);
				this.router.navigate(['']);
			}
		}, 5000);
	}

	ngOnDestroy(): void { }
}
