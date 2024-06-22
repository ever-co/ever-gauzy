import { Component, OnInit, NgZone, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
	DomSanitizer,
	SafeResourceUrl,
	SafeUrl,
} from '@angular/platform-browser';
import { ElectronService } from '../electron/services';
import { GAUZY_ENV } from '../constants';

@Component({
	selector: 'ngx-screen-capture',
	templateUrl: './screen-capture.component.html',
	styleUrls: ['./screen-capture.component.scss'],
})
export class ScreenCaptureComponent implements OnInit {
	private _screenCaptureUrl$: BehaviorSubject<SafeUrl>;
	screenCaptureUrl: SafeUrl;
	note: string;

	constructor(
		private readonly electronService: ElectronService,
		private _ngZone: NgZone,
		private domSanitizer: DomSanitizer,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {
		this._screenCaptureUrl$ = new BehaviorSubject(null);
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.on(
			'show_popup_screen_capture',
			(event, arg) => {
				this._ngZone.run(() => {
					this.note = arg.note;
					this._screenCaptureUrl$.next(
						this.domSanitizer.bypassSecurityTrustUrl(arg.imgUrl)
					);
				});
			}
		);
	}

	public get screenCaptureUrl$(): Observable<SafeUrl> {
		return this._screenCaptureUrl$.asObservable();
	}

	public get logoUrl(): SafeResourceUrl {
		return this._domSanitizer.bypassSecurityTrustResourceUrl(
			this._environment.I4NET_DESKTOP_LOGO_512X512
		);
	}
}
