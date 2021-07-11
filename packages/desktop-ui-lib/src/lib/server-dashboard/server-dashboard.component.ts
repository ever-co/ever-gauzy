import {
	Component,
	OnInit,
	ViewChild,
	ElementRef,
	ChangeDetectorRef,
	ChangeDetectionStrategy
} from '@angular/core';
import { ElectronService } from 'ngx-electron';

@Component({
	selector: 'ngx-server-dashboard',
	templateUrl: './server-dashboard.component.html',
	styleUrls: ['./server-dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ServerDashboardComponent implements OnInit {
	active_index: any;
    gauzyIcon = './assets/images/logos/logo_Gauzy.svg';
	running=false;

    constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef
	) {
		this.electronService.ipcRenderer.on(
			'running_state',
			(event, arg) => {
				this.running = arg
				this._cdr.detectChanges();
			}
		);
	}

	
	ngOnInit(): void {
		this.active_index = 0;
	}

    runServer() {
		this.running = true;
        this.electronService.ipcRenderer.send('run_gauzy_server');
    }

	stopServer() {
		this.running = false;
		this.electronService.ipcRenderer.send('stop_gauzy_server');
	}
}
