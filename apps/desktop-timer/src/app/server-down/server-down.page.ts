import { Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Store } from '../auth/services/store.service';
import { ServerConnectionService } from '../auth/services/server-connection.service';
import { environment } from '../../../../gauzy/src/environments/environment';
import { Router } from '@angular/router';

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

			if (Number(this.store.serverConnection) === 200) {
				clearInterval(this.interval);
				this.router.navigate(['']);
			}
		}, 5000);
	}

	ngOnDestroy(): void {}
}
