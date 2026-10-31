import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
import { NbButtonModule, NbCardModule, NbIconModule, NbLayoutModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { BehaviorSubject, catchError, Observable, tap } from 'rxjs';
import { GAUZY_ENV } from '../constants';
import { ElectronService } from '../electron/services';

/**
 * IPC channel the close button sends: the main process hides this notification at once (#7643).
 * Mirrors `ScreenCaptureNotification.CLOSE_CHANNEL` of @gauzy/desktop-window, which runs in the main process.
 */
export const CLOSE_SCREEN_CAPTURE_NOTIFICATION = 'close_screen_capture_notification';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-screen-capture',
	templateUrl: './screen-capture.component.html',
	styleUrls: ['./screen-capture.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbLayoutModule, NbCardModule, NbButtonModule, NbIconModule, AsyncPipe, TranslatePipe]
})
export class ScreenCaptureComponent implements OnInit {
	private _screenCaptureUrl$: BehaviorSubject<SafeUrl>;
	screenCaptureUrl: SafeUrl;
	note: string;

	constructor(
		private readonly electronService: ElectronService,
		private domSanitizer: DomSanitizer,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private readonly _domSanitizer: DomSanitizer
	) {
		this._screenCaptureUrl$ = new BehaviorSubject(null);
	}

	ngOnInit(): void {
		this.electronService
			.fromEvent<{ note: string; imgUrl: string }>('show_popup_screen_capture')
			.pipe(
				tap(({ note, imgUrl }) => {
					this.note = note;
					this._screenCaptureUrl$.next(this.domSanitizer.bypassSecurityTrustUrl(imgUrl));
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.sendRendererReady();
	}

	/** Hides the notification now, instead of waiting for it to go away on its own (#7643). */
	public close(): void {
		this.electronService.ipcRenderer?.send(CLOSE_SCREEN_CAPTURE_NOTIFICATION);
	}

	private async sendRendererReady() {
		if (!this._environment.IS_AGENT) return;
		this.electronService
			.invoke$('capture_window_init')
			.pipe(
				catchError((error) => {
					console.error('Error initializing screen capture:', error);
					return [];
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get screenCaptureUrl$(): Observable<SafeUrl> {
		return this._screenCaptureUrl$.asObservable();
	}

	public get logoUrl(): SafeResourceUrl {
		return this._domSanitizer.bypassSecurityTrustResourceUrl(this._environment.GAUZY_DESKTOP_LOGO_512X512);
	}
}
