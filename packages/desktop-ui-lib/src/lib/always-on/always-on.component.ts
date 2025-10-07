import { Component, NgZone, OnDestroy, OnInit, Inject, Renderer2, HostBinding } from '@angular/core';
import { NbIconLibraries } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, Subscription, tap } from 'rxjs';
import { LanguageElectronService } from '../language/language-electron.service';
import { AlwaysOnService, AlwaysOnStateEnum, ITimeCounter, ITimerStatus } from './always-on.service';
import { faPlay, faPause, faStopwatch, faBars } from '@fortawesome/free-solid-svg-icons';
import { GAUZY_ENV } from '../constants';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-always-on',
	templateUrl: './always-on.component.html',
	styleUrls: ['./always-on.component.scss'],
	standalone: false
})
export class AlwaysOnComponent implements OnInit, OnDestroy {
	@HostBinding('class.rounded-theme') isRounded = false;
	public start$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isOffline$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public loading: boolean = false;
	public isTrackingEnabled: boolean = true;
	public running = false;
	public isBillable = true;

	play = faPlay;
	pause = faPause;
	stopwatch = faStopwatch;
	bars = faBars;
	public isExpandMode: boolean = false;

	private _counter$: BehaviorSubject<ITimeCounter> = new BehaviorSubject({
		current: '--:--:--',
		today: '--:--'
	});

	private localCounterSub?: Subscription;

	constructor(
		private _alwaysOnService: AlwaysOnService,
		private _iconLibraries: NbIconLibraries,
		private _languageElectronService: LanguageElectronService,
		private _ngZone: NgZone,
		@Inject(GAUZY_ENV)
		private readonly _environment: Record<string, any>,
		private renderer: Renderer2
	) {
		this._iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa'
		});
	}

	ngOnInit(): void {
		this._languageElectronService.initialize<void>();
		this._alwaysOnService.state$
			.pipe(
				tap((state: AlwaysOnStateEnum) => {
					this._ngZone.run(() => {
						switch (state) {
							case AlwaysOnStateEnum.STARTED:
								this.start$.next(true);
								this.loading = false;
								break;
							case AlwaysOnStateEnum.STOPPED:
								this.start$.next(false);
								this.loading = false;
								break;
							case AlwaysOnStateEnum.LOADING:
								this.loading = true;
								break;
							default:
								this.loading = false;
								break;
						}
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._alwaysOnService.counter$
			.pipe(
				tap((time: ITimeCounter) => {
					this._ngZone.run(() => {
						this._counter$.next(time);
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();
		if (this.isAgent) {
			this.isExpandMode = true;
			this._alwaysOnService.checkTimerStatus$.pipe(
				tap(() => {
					this.checkAndRunTimer();
				}),
				untilDestroyed(this)
			).subscribe();
			this.checkAndRunTimer();
		}

		if (this.isExpandMode) {
			this.renderer.setStyle(document.body, 'background-color', 'transparent');
			this.isRounded = true;
		}
	}

	ngOnDestroy(): void {
		this.localCounterSub?.unsubscribe();
	}

	public run(): void {
		this._alwaysOnService.run(AlwaysOnStateEnum.LOADING);
	}

	async toggleTimer() {
		this.setLoading(true);
		try {
			await this._alwaysOnService.toggleTimer();
		} catch (error) {
			console.error('Failed to toggle timer:', error);
			this.setLoading(false);
		}

	}

	async setLoading(isLoading: boolean) {
		this._ngZone.run(() => {
			this.loading = isLoading;
		});
	}

	async setRunning(isRunning: boolean) {
		this._ngZone.run(() => {
			this.running = isRunning;
		});
	}

	private async checkAndRunTimer() {
		this.setLoading(true);
		const timerStatus: ITimerStatus = await this._alwaysOnService.getTimerStatus();
		this.localCounterSub?.unsubscribe();
		if (timerStatus?.running) {
			this.setRunning(true);
			this._alwaysOnService.init(timerStatus.duration, timerStatus?.startedAt);
			this.localCounterSub = this._alwaysOnService.localCounter$.subscribe((counter: ITimeCounter) => {
				this._counter$.next(counter);
			});
			this.setLoading(false);
			return;
		}

		if (!timerStatus?.running) {
			this.setRunning(false);
			this.localCounterSub?.unsubscribe();
		}
		this.setLoading(false);
	}

	public get isAgent(): boolean {
		return this._environment.IS_AGENT;
	}


	public get counter$(): Observable<ITimeCounter> {
		return this._counter$.asObservable();
	}
}
