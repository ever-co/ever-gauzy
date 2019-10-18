import { Component, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../@core/services/store.service';
import { ServerConnectionService } from '../@core/services/server-connection.service';
import { environment } from '../../environments/environment';

@Component({
	styleUrls: ['./server-down.page.scss'],
	templateUrl: 'server-down.page.html'
})
export class ServerDownPage implements OnDestroy {
	noInternetLogo: string;
	interval;

	constructor(
		private store: Store,
		private readonly http: HttpClient,
		private location: Location,
		private translate: TranslateService,
		private serverConnectionService: ServerConnectionService
	) {
		this.testConnection();
	}

	private async testConnection() {
		this.interval = setInterval(async () => {
			console.log('back location');

			await this.serverConnectionService.checkServerConnection(
				environment.API_BASE_URL,
				this.store
			);

			if (Number(this.store.serverConnection) !== 0) {
				clearInterval(this.interval);
				this.location.back();
			}
		}, 5000);
	}

	ngOnDestroy(): void {}
}
