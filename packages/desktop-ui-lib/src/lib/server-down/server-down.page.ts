import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ServerConnectionService, Store } from '../services';
import { GAUZY_ENV } from '../constants';

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
		private readonly router: Router,
		@Inject(GAUZY_ENV)
		private readonly environment: any
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
	}

	private checkConnection() {
		this.interval = setInterval(async () => {
			await this.serverConnectionService.checkServerConnection(
				this.environment.API_BASE_URL
			);
			if (
				Number(this.store.serverConnection) === 200 ||
				this.store.userId
			) {
				clearInterval(this.interval);
				await this.router.navigate(['']);
			}
		}, 5000);
	}

	ngOnInit(): void {
		this.checkConnection();
	}

	ngOnDestroy(): void {}
}
