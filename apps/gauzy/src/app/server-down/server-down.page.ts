import { Component, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Store } from '../@core/services/store.service';
import { ServerConnectionService } from '../@core/services/server-connection.service';
import { environment } from '../../environments/environment';

@Component({
	styleUrls: ['./server-down.page.scss'],
	templateUrl: 'server-down.page.html'
})
export class ServerDownPage implements OnDestroy {
	noInternetLogo: string;
	interval: any;

	constructor(
		private store: Store,
		private location: Location,
		private serverConnectionService: ServerConnectionService
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
		this.checkConnection();
	}

	private async checkConnection() {
		this.interval = setInterval(async () => {
			await this.serverConnectionService.checkServerConnection(
				environment.API_BASE_URL
			);

			if (Number(this.store.serverConnection) === 200) {
				clearInterval(this.interval);
				this.location.back();
			}
		}, 5000);
	}

	ngOnDestroy(): void {}
}
