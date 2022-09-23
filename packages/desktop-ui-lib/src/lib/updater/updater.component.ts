import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef,
	NgZone
} from '@angular/core';
import { ElectronService } from '../electron/services';

@Component({
	selector: 'ngx-updater',
	templateUrl: './updater.component.html',
	styleUrls: ['./updater.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdaterComponent implements OnInit {
	@ViewChild('logbox') logbox: ElementRef;
	@ViewChild('logUpdate') logAccordion;
	constructor(
		private electronService: ElectronService,
		private _ngZone: NgZone,
		private electronServices: ElectronService
	) {}
	version = '0.0.0';
	loading = false;
	notAvailable = false;
	message = 'Application Update';
	downloadFinish = false;
	logContents: any = [];
	logIsOpen: boolean = false;

	ngOnInit(): void {
		this.electronService.ipcRenderer.on('update-not-available', () =>
			this._ngZone.run(() => {
				this.notAvailable = true;
				this.message = 'Application Update';
				this.logContents.push(this.message);
				this.scrollToBottom();
			})
		);

		this.electronService.ipcRenderer.on('update_available', () =>
			this._ngZone.run(() => {
				this.notAvailable = true;
				this.message = 'Update Available';
				this.logContents.push(this.message);
				this.scrollToBottom();
			})
		);

		this.electronService.ipcRenderer.on('update_downloaded', () =>
			this._ngZone.run(() => {
				this.notAvailable = true;
				this.message = 'Update Download Completed';
				this.logContents.push(this.message);
				this.scrollToBottom();
				this.downloadFinish = true;
				this.loading = false;
			})
		);

		this.electronService.ipcRenderer.on(
			'download_on_progress',
			(event, arg) =>
				this._ngZone.run(() => {
					this.notAvailable = true;
					this.message = `Update Downloading ${
						arg.percent ? Math.floor(Number(arg.percent)) : 0
					}%`;
					this.logContents.push(this.message);
					this.scrollToBottom();
				})
		);
		this.version = this.electronServices.remote.app.getVersion();
	}

	checkForUpdate() {
		this.loading = true;
		this.electronService.ipcRenderer.send('check_for_update');
	}

	restartAndUpdate() {
		this.electronService.ipcRenderer.send('restart_and_update');
	}

	logBoxChange(e) {
		if (e) {
			this.logIsOpen = false;
		} else {
			this.logIsOpen = true;
		}
	}

	private scrollToBottom() {
		this.logbox.nativeElement.scrollTop =
			this.logbox.nativeElement.scrollHeight;
	}
}
