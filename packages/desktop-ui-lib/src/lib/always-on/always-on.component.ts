import { AfterViewInit, Component, NgZone, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguagesEnum } from '@gauzy/contracts';
import { BehaviorSubject, from, Observable, tap } from 'rxjs';
import { ElectronService } from '../electron/services';
import { LanguageSelectorService } from '../language/language-selector.service';
import { TimeTrackerDateManager } from '../services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AlwaysOnService, AlwaysOnStateEnum, ITimeCounter } from './always-on.service';
import { NbIconLibraries } from '@nebular/theme';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-always-on',
	templateUrl: './always-on.component.html',
	styleUrls: ['./always-on.component.scss'],
})
export class AlwaysOnComponent implements OnInit, AfterViewInit {
	public start$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isOffline$: BehaviorSubject<boolean> = new BehaviorSubject(false)
	public loading: boolean = false;
	public isTrackingEnabled: boolean = true;

	private _counter$: BehaviorSubject<ITimeCounter> = new BehaviorSubject({
		current: '--:--:--',
		today: '--:--'
	});

	constructor(
		private _languageSelectorService: LanguageSelectorService,
		private _electronService: ElectronService,
		private _translateService: TranslateService,
		private _alwaysOnService: AlwaysOnService,
		private _iconLibraries: NbIconLibraries,
		private _ngZone: NgZone
	) {
		this._iconLibraries.registerFontPack('font-awesome', {
			packClass: 'fas',
			iconClassPrefix: 'fa',
		});
	}

	ngAfterViewInit(): void {
		from(this._electronService.ipcRenderer.invoke('PREFERRED_LANGUAGE'))
			.pipe(
				tap((language: LanguagesEnum) => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
					TimeTrackerDateManager.locale(language);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnInit(): void {
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
		this._electronService.ipcRenderer.on(
			'preferred_language_change',
			(event, language: LanguagesEnum) => {
				this._ngZone.run(() => {
					this._languageSelectorService.setLanguage(
						language,
						this._translateService
					);
					TimeTrackerDateManager.locale(language);
				});
			}
		);
		this._electronService.ipcRenderer.on('offline-handler', (event, isOffline) => {
			this._ngZone.run(() => {
				this.isOffline$.next(isOffline);
			});
		});
	}

	public run(): void {
		this._alwaysOnService.run(AlwaysOnStateEnum.LOADING);
	}

	public get counter$(): Observable<ITimeCounter> {
		return this._counter$.asObservable();
	}
}
