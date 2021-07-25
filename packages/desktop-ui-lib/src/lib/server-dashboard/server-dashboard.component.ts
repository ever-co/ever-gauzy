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
	loading = false;
	btn:any = {
		name: 'Start',
		icon: 'play-circle-outline'
	}

    constructor(
		private electronService: ElectronService,
		private _cdr: ChangeDetectorRef
	) {
		this.electronService.ipcRenderer.on(
			'running_state',
			(event, arg) => {
				this.loading = false;
				this.btn = {
					name: arg ? 'Stop' : 'Start',
					icon: arg ? 'stop-circle-outline' : 'play-circle-outline'
				};
				this.running = arg
				this._cdr.detectChanges();
			}
		);
	}

	
	ngOnInit(): void {
		this.active_index = 0;
	}

    runServer() {
		this.loading = true;
		this.btn = {
			name: '',
			icon: ''
		};
        this.electronService.ipcRenderer.send('run_gauzy_server');
		this._cdr.detectChanges();
    }

	stopServer() {
		this.loading = true;
		this.btn = {
			name: '',
			icon: ''
		};
		this.electronService.ipcRenderer.send('stop_gauzy_server');
		this._cdr.detectChanges();
	}
}
