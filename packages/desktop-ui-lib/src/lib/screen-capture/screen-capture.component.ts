import { Component, OnInit, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ElectronService } from '../electron/services';

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
		private domSanitizer: DomSanitizer
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
}
