import { Component, OnInit } from '@angular/core';
import { ElectronService } from 'ngx-electron';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit {
	constructor(
		private electronService: ElectronService
	) {
		
	}

	ngOnInit(): void {
		console.log('on init');
	}
}
