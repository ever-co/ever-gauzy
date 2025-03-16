import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ViewChild,
	ElementRef,
	NgZone,
} from '@angular/core';
import { ElectronService } from '../electron/services';

@Component({
	selector: 'ngx-updater',
	templateUrl: './updater.component.html',
	styleUrls: ['./updater.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdaterComponent implements OnInit {
	@ViewChild('logBox') logBox: ElementRef;
	@ViewChild('logUpdate') logAccordion;
	constructor(
		private electronService: ElectronService,
		private _ngZone: NgZone
	) {}
	version = '0.0.0';
	loading = false;
	notAvailable = false;
	message = 'Application Update';
	downloadFinish = false;
	logContents: any = [];
	logIsOpen: boolean = false;

	handleIpcEvent(_: any, arg: { type: string, data: any }) {
		switch (arg.type) {
			case 'update_available': {
				this._ngZone.run(() => {
					this.notAvailable = true;
					this.message = 'Update Available';
					this.logContents.push(this.message);
					this.scrollToBottom();
				});
				break;
			}
			case 'update-not-available': {
				this._ngZone.run(() => {
					this.notAvailable = true;
					this.message = 'Application Update';
					this.logContents.push(this.message);
					this.scrollToBottom();
				});
				break;
			}
			case 'update_downloaded': {
				this._ngZone.run(() => {
					this.notAvailable = true;
					this.message = 'Update Download Completed';
					this.logContents.push(this.message);
					this.scrollToBottom();
					this.downloadFinish = true;
					this.loading = false;
				});
				break;
			}
			case 'download_on_progress': {
				this._ngZone.run(() => {
					this.notAvailable = true;
					this.message = `Update Downloading ${
						arg.data.percent ? Math.floor(Number(arg.data.percent)) : 0
					}%`;
					this.logContents.push(this.message);
					this.scrollToBottom();
				});
				break;
			}
			default:
				break;
		}
	}

	ngOnInit(): void {
		this.electronService.ipcRenderer.on('setting_page_ipc', this.handleIpcEvent);
		this.version = this.electronService.remote.app.getVersion();
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
		this.logBox.nativeElement.scrollTop =
			this.logBox.nativeElement.scrollHeight;
	}
}
