import { Component, OnInit, NgZone } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ElectronService } from '../electron/services';
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);
@Component({
	selector: 'ngx-screen-capture',
	templateUrl: './screen-capture.component.html',
	styleUrls: ['./screen-capture.component.scss']
})
export class ScreenCaptureComponent implements OnInit {
	screenCaptureUrl: SafeUrl;
	note: string;

	constructor(
		private readonly electronService: ElectronService,
		private _ngZone: NgZone,
		private domSanitizer: DomSanitizer
	) {}

	ngOnInit(): void {
		const imgSrc = this.electronService.remote.getGlobal('variableGlobal');
		this.electronService.ipcRenderer.on(
			'show_popup_screen_capture',
			(event, arg) => {
				this._ngZone.run(() => {
					this.note = arg.note;
				});
			}
		);
		this.screenCaptureUrl = this.domSanitizer.bypassSecurityTrustUrl(
			imgSrc.screenshotSrc
		);
	}
}
