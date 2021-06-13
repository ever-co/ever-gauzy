import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from 'ngx-electron';
@Component({
	selector: 'ngx-screen-capture',
	templateUrl: './splash-screen.component.html',
	styleUrls: ['./splash-screen.component.scss']
})
export class SplashScreenComponent implements OnInit {
	screenCaptureUrl: string;
	note: string;

	constructor(
		private readonly electronService: ElectronService,
		private _cdr: ChangeDetectorRef
	) {
		this.electronService.ipcRenderer.on(
			'show_popup_screen_capture',
			(event, arg) => {
				this.screenCaptureUrl = arg.imgUrl;
				this.note = arg.note;
				this._cdr.detectChanges();
			}
		);
	}

	ngOnInit(): void {}
}
