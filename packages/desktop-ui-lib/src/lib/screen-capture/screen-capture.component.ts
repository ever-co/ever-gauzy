import { AsyncPipe } from '@angular/common';
import { Component, Inject, NgZone, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { NbCardModule, NbLayoutModule } from '@nebular/theme';
import { BehaviorSubject, Observable } from 'rxjs';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';

@Component({
	selector: 'ngx-screen-capture',
	templateUrl: './screen-capture.component.html',
	styleUrls: ['./screen-capture.component.scss'],
	imports: [NbLayoutModule, NbCardModule, AsyncPipe]
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
		this.electronService.ipcRenderer.on('show_popup_screen_capture', (_, arg) => {
			this._ngZone.run(() => {
				this.note = arg.note;
				this._screenCaptureUrl$.next(this.domSanitizer.bypassSecurityTrustUrl(arg.imgUrl));
			});
		});
		this.sendRendererReady();
	}

	private async sendRendererReady() {
		if (!this._environment.IS_AGENT) return;
		await this.electronService
			.invoke('capture_window_init')
			.catch(() => console.error('Page initialize not implemented in main process'));
	}

	public get screenCaptureUrl$(): Observable<SafeUrl> {
		return this._screenCaptureUrl$.asObservable();
	}

	public get logoUrl(): SafeResourceUrl {
		return this._domSanitizer.bypassSecurityTrustResourceUrl(this._environment.GAUZY_DESKTOP_LOGO_512X512);
	}
}
