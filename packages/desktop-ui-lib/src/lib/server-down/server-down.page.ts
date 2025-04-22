import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { EMPTY, from, interval, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { GAUZY_ENV } from '../constants';
import { LanguageElectronService } from '../language/language-electron.service';
import { ServerConnectionService, Store } from '../services';

@UntilDestroy({ checkProperties: true })
@Component({
    styleUrls: ['./server-down.page.scss'],
    templateUrl: 'server-down.page.html',
    standalone: false
})
export class ServerDownPage implements OnInit, OnDestroy {
	public noInternetLogo: string;
	private destroy$ = new Subject<void>();

	constructor(
		private readonly store: Store,
		private readonly serverConnectionService: ServerConnectionService,
		private readonly router: Router,
		@Inject(GAUZY_ENV)
		private readonly environment: any,
		private readonly languageElectronService: LanguageElectronService
	) {
		this.noInternetLogo = environment['NO_INTERNET_LOGO'];
	}

	public get companySite(): string {
		return this.environment.COMPANY_SITE_NAME;
	}

	private setupConnectionMonitoring(): void {
		const url = this.environment.API_BASE_URL;
		const checkIntervalMs = 5000;

		interval(checkIntervalMs)
			.pipe(
				tap(() => console.log('Checking server connection to URL:', url)),
				switchMap(() =>
					from(this.serverConnectionService.checkServerConnection(url)).pipe(
						distinctUntilChanged(),
						tap(() => console.log('Server connection status:', this.store.serverConnection)),
						filter(() => Number(this.store.serverConnection) === 200 || !!this.store.userId),
						tap(() => this.router.navigate(['/'])),
						catchError(() => EMPTY) // Silently handle errors to keep the stream alive
					)
				),
				takeUntil(this.destroy$)
			)
			.subscribe({
				complete: () => console.log('Connection monitoring completed')
			});
	}

	ngOnInit(): void {
		this.languageElectronService.initialize();
		this.setupConnectionMonitoring();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
