import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from 'ngx-electron';
import { AppService } from './app.service';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent {
	constructor(
		private router: Router,
		private electronService: ElectronService,
		private appService: AppService
	) {
		this.electronService.ipcRenderer.on('collect_data', (event, arg) => {
			appService.collectevents(arg.start, arg.end).then((res) => {
				event.sender.send('data_push_activity', {
					timerId: arg.timerId,
					windowEvent: res
				});
			});
		});
	}
}
