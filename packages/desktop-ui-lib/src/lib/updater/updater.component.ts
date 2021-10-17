import {
	Component,
	OnInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef
} from '@angular/core';
import { ElectronService } from 'ngx-electron';
import { ElectronServices } from '../electron/services';

@Component({
	selector: 'ngx-updater',
	templateUrl: './updater.component.html',
	styleUrls: ['./updater.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdaterComponent implements OnInit {
	constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef,
		private electronServices: ElectronServices
	) {
		electronService.ipcRenderer.on('update-not-available', () => {
			this.notAvailable = true;
			this.message = 'Application Uptodate';
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('update_available', () => {
			this.notAvailable = true;
			this.message = 'Update Available';
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('update_downloaded', () => {
			this.notAvailable = true;
			this.message = 'Update Download Completed';
			this.downloadFinish = true;
			this.loading = false;
			this._cdr.detectChanges();
		});

		electronService.ipcRenderer.on('download_on_progress', (event, arg) => {
			this.notAvailable = true;
			this.message = `Update Downloading ${
				arg.percent ? Math.floor(Number(arg.percent)) : 0
			}%`;
			this._cdr.detectChanges();
		});
	}
	version = '0.0.0';
	loading = false;
	notAvailable = false;
	message = 'Application Uptodate';
	downloadFinish = false;

	ngOnInit(): void {
		this.version = this.electronServices.remote.app.getVersion();
	}

	checkForUpdate() {
		this.loading = true;
		this.electronService.ipcRenderer.send('check_for_update');
	}

	restartAndUpdate() {
		this.electronService.ipcRenderer.send('restart_and_update');
	}
}
