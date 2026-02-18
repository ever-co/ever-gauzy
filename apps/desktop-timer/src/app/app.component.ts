import { AfterViewInit, Component, NgZone, OnInit, Renderer2 } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import {
	ActivityWatchElectronService,
	AuthStrategy,
	ElectronService,
	LanguageElectronService,
	Store,
	TimeTrackerDateManager,
	TokenRefreshService
} from '@gauzy/desktop-ui-lib';
import { NbToastrService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { catchError, exhaustMap, filter, from, interval, map, Observable, of, tap } from 'rxjs';
import { concatMap, switchMap, take, takeWhile } from 'rxjs/operators';
import { AppService } from './app.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>',
	styleUrls: ['./app.component.scss'],
	imports: [RouterOutlet]
})
export class AppComponent implements OnInit, AfterViewInit {
	constructor(
		private electronService: ElectronService,
		private appService: AppService,
		private authStrategy: AuthStrategy,
		public readonly translate: TranslateService,
		private store: Store,
		private toastrService: NbToastrService,
		private _ngZone: NgZone,
		private _renderer: Renderer2,
		readonly activityWatchElectronService: ActivityWatchElectronService,
		readonly languageElectronService: LanguageElectronService,
		private readonly tokenRefreshService: TokenRefreshService,
		private readonly router: Router
	) {
		activityWatchElectronService.setupActivitiesCollection();
	}

	ngOnInit(): void {
		const nebularLinkMedia = document.querySelector('link[media="print"]');
		if (nebularLinkMedia) this._renderer?.setAttribute(nebularLinkMedia, 'media', 'all');

		this.electronService.ipcRenderer.send('app_is_init');
	}

	ngAfterViewInit(): void {
		this.languageElectronService.initialize();

		this.electronService
			.fromEvent('timer_tracker_show')
			.pipe(
				take(1),
				tap(() => this.tokenRefreshService.start()),
				untilDestroyed(this)
			)
			.subscribe();

		this.electronService
			.fromEvent<{ host: string }>('server_ping')
			.pipe(
				switchMap((arg) =>
					interval(1000).pipe(
						exhaustMap(() =>
							from(this.appService.pingServer(arg)).pipe(
								map(() => 200),
								catchError((err) => of(err?.status ?? 0))
							)
						),
						tap((status) => {
							this.store.serverConnection = status;
						}),
						takeWhile((status) => status !== 200 && !this.store.userId, true),
						filter((status) => status === 200 || !!this.store.userId),
						//take(1),
						tap(() => {
							console.log('Server Ready');
							this.electronService.ipcRenderer.send('server_is_ready');
						})
					)
				)
			)
			.pipe(untilDestroyed(this))
			.subscribe();

		this.electronService.ipcRenderer.on('server_ping_restart', (event, arg) =>
			this._ngZone.run(() => {
				const pingHost = setInterval(async () => {
					try {
						await this.appService.pingServer(arg);
						console.log('Server Found');
						event.sender.send('server_already_start');
						this.store.serverConnection = 200;
						clearInterval(pingHost);
					} catch (error) {
						console.log('ping status result', error.status);
						this.store.serverConnection = 0;
						if (this.store.userId) {
							event.sender.send('server_already_start');
							clearInterval(pingHost);
						}
					}
				}, 3000);
			})
		);

		this.electronService.ipcRenderer.on('logout_timer', (event, arg) =>
			this._ngZone.run(() => {
				console.log(event, arg);
			})
		);

		this.electronService
			.fromEvent<boolean>('__logout__')
			.pipe(
				tap(() => this.tokenRefreshService.stop()),
				// Ensure logout runs sequentially
				concatMap((shouldRestart) =>
					this.performLogout().pipe(
						map(() => shouldRestart),
						catchError(() => of(shouldRestart)) // Logout failure should not block UI flow
					)
				),
				tap((shouldRestart) => this.handlePostLogout(shouldRestart)),
				untilDestroyed(this)
			)
			.subscribe();

		this.electronService.ipcRenderer.on('social_auth_success', (event, arg) =>
			this._ngZone.run(async () => {
				try {
					this.store.userId = arg.userId;
					this.store.token = arg.token;
					await this.authFromSocial(arg);
				} catch (error) {
					console.log('ERROR', error);
				}
			})
		);
	}

	async authFromSocial(arg) {
		const jwtParsed: any = await this.jwtDecode(arg.token);
		if (jwtParsed) {
			if (jwtParsed.employeeId) {
				const user: any = await this.appService.getUserDetail();
				TimeTrackerDateManager.organization = user?.employee?.organization;
				this.store.organizationId = user?.employee?.organizationId;
				this.store.tenantId = jwtParsed.tenantId;
				this.store.user = user;
				this.electronService.ipcRenderer.send('auth_success', {
					user: user,
					token: arg.token,
					userId: arg.userId,
					employeeId: jwtParsed.employeeId,
					tenantId: jwtParsed.tenantId,
					organizationId: user.employee ? user.employee.organizationId : null
				});
			} else {
				this.toastrService.show('Your account is not an employee', `Warning`, {
					status: 'danger'
				});
			}
		}
	}

	async jwtDecode(token) {
		try {
			return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
		} catch (e) {
			return null;
		}
	}

	private performLogout(): Observable<void> {
		return this.authStrategy.logout().pipe(
			take(1),
			map(() => void 0)
		);
	}

	private handlePostLogout(shouldRestart: boolean): void {
		if (shouldRestart) {
			this.electronService.ipcRenderer.send('restart_and_update');
			return;
		}

		this.electronService.ipcRenderer.send('navigate_to_login');
		this.router.navigate(['/auth/login']);
	}
}
