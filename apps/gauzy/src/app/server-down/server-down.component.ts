import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Environment, GAUZY_ENV } from '@gauzy/ui-config';
import { ServerConnectionService, Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-server-down-page',
	styleUrls: ['./server-down.component.scss'],
	templateUrl: './server-down.component.html'
})
export class ServerDownComponent implements OnInit, OnDestroy {
	noInternetLogo: string;
	interval: any;

	constructor(
		private readonly store: Store,
		private readonly location: Location,
		private readonly serverConnectionService: ServerConnectionService,
		@Inject(GAUZY_ENV) private environment: Environment
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
	}

	ngOnInit(): void {
		this.checkConnection();
	}

	/**
	 * Checks the server connection every 5 seconds.
	 */
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

	/**
	 * Checks if the company site is defined in the environment.
	 *
	 * @return {string} The company site name.
	 */
	public get companySite(): string {
		return this.environment.COMPANY_SITE_NAME;
	}

	ngOnDestroy(): void {}
}
