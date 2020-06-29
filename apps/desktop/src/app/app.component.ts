import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from 'ngx-electron';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent {
	constructor(
		private router: Router,
		private electronService: ElectronService
	) {
		this.electronService.ipcRenderer.on('start_tracking', (event, arg) => {
			console.log('time record start', arg);
		});
	}
}
