import { Component, NgZone, OnInit } from '@angular/core';
import { NbIconLibraries } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { LanguageElectronService } from '../language/language-electron.service';
import { AlwaysOnService, AlwaysOnStateEnum, ITimeCounter } from './always-on.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-always-on',
	templateUrl: './always-on.component.html',
	styleUrls: ['./always-on.component.scss']
})
export class AlwaysOnComponent implements OnInit {
	public start$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isOffline$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public loading: boolean = false;
	public isTrackingEnabled: boolean = true;

	private _counter$: BehaviorSubject<ITimeCounter> = new BehaviorSubject({
		current: '--:--:--',
		today: '--:--'
	});

	constructor(
		private _alwaysOnService: AlwaysOnService,
		private _iconLibraries: NbIconLibraries,
		private _languageElectronService: LanguageElectronService,
		private _ngZone: NgZone
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
	}

	public run(): void {
		this._alwaysOnService.run(AlwaysOnStateEnum.LOADING);
	}

	public get counter$(): Observable<ITimeCounter> {
		return this._counter$.asObservable();
	}
}
