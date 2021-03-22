import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ElectronService } from 'ngx-electron';
@Component({
	selector: 'ngx-screen-capture',
	templateUrl: './screen-capture.component.html',
	styleUrls: ['./screen-capture.component.scss']
})
export class ScreenCaptureComponent implements OnInit {
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
