import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../electron/services';

@Component({
	selector: 'ngx-splash-screen',
	templateUrl: './splash-screen.component.html',
	styleUrls: ['./splash-screen.component.scss'],
})
export class SplashScreenComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: ''
	};

	constructor(
		private readonly _electronService: ElectronService,
	) {
		this._application = {
			name: _electronService.remote.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
					letter.toUpperCase()
				),
			version: _electronService.remote.app.getVersion(),
			iconPath: './assets/images/logos/logo_Gauzy.svg'
		};
	}

	ngOnInit(): void { }

	public get application() {
		return this._application;
	}
}
