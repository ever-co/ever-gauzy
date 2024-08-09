import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { GAUZY_ENV } from '../constants';
import { LanguageElectronService } from '../language/language-electron.service';
import { ServerConnectionService, Store } from '../services';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./server-down.page.scss'],
	templateUrl: 'server-down.page.html'
})
export class ServerDownPage implements OnInit, OnDestroy {
	noInternetLogo: string;
	interval: any;

	constructor(
		private store: Store,
		private serverConnectionService: ServerConnectionService,
		private readonly router: Router,
		@Inject(GAUZY_ENV)
		private readonly environment: any,
		private readonly languageElectronService: LanguageElectronService
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
	}

	public get companySite() {
		return this.environment.COMPANY_SITE_NAME;
	}

	private checkConnection() {
		const url = this.environment.API_BASE_URL;

		this.interval = setInterval(async () => {
			console.log('Checking server connection in checkConnection to URL: ', url);

			await this.serverConnectionService.checkServerConnection(url);

			console.log('Server connection status in checkConnection: ', this.store.serverConnection);

			if (Number(this.store.serverConnection) === 200 || this.store.userId) {
				clearInterval(this.interval);
				await this.router.navigate(['']);
			}
		}, 5000);
	}

	ngOnInit(): void {
		this.languageElectronService.initialize<void>();
		this.checkConnection();
	}

	ngOnDestroy(): void {}
}
