import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Store } from '../@core/services/store.service';
import { ServerConnectionService } from '../@core/services/server-connection.service';
import { GAUZY_ENV } from '../@core';
import { Environment } from '../../environments/model';

@Component({
	styleUrls: ['./server-down.page.scss'],
	templateUrl: 'server-down.page.html'
})
export class ServerDownPage implements OnInit, OnDestroy {
	noInternetLogo: string;
	interval: any;

	constructor(
		private store: Store,
		private location: Location,
		private serverConnectionService: ServerConnectionService,
		@Inject(GAUZY_ENV)
		private environment: Environment
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
	}

	ngOnInit(): void {
		this.checkConnection();
	}

	private async checkConnection() {
		const url = this.environment.API_BASE_URL;
		console.log('Checking server connection to URL: ', url);

		this.interval = setInterval(async () => {
			console.log('Checking server connection...');

			await this.serverConnectionService.checkServerConnection(url);

			if (Number(this.store.serverConnection) === 200) {
				console.log('Server is online');
				clearInterval(this.interval);
				this.location.back();
			} else {
				console.log('Server is offline');
			}
		}, 5000);
	}

	public get companySite(): string {
		return this.environment.COMPANY_SITE;
	}

	ngOnDestroy(): void {}
}
