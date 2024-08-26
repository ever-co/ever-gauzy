import { Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { environment } from '@gauzy/ui-config';
import { ServerConnectionService, Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-maintenance-mode',
	styleUrls: ['./maintenance-mode.component.scss'],
	templateUrl: './maintenance-mode.component.html'
})
export class MaintenanceModeComponent implements OnInit, OnDestroy {
	noInternetLogo: string;
	interval: any;

	constructor(
		private readonly _store: Store,
		private readonly _location: Location,
		private readonly _serverConnectionService: ServerConnectionService
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
		const url = environment.API_BASE_URL;
		console.log('Checking server connection to URL: ', url);

		this.interval = setInterval(async () => {
			console.log('Checking server connection...');
			await this._serverConnectionService.checkServerConnection(url);

			// Check if the server is online
			if (Number(this._store.serverConnection) === 200) {
				console.log('Server is online');
				clearInterval(this.interval);
				this._location.back();
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
		return environment.COMPANY_SITE_NAME;
	}

	ngOnDestroy(): void {}
}
