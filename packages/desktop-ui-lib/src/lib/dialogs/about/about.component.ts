import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../../electron/services';

@Component({
	selector: 'gauzy-about',
	templateUrl: './about.component.html',
	styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
	private _application = {
		name: 'gauzy-dev',
		version: 'dev',
		iconPath: ''
	};
	constructor(private readonly _electronService: ElectronService) {}

	ngOnInit(): void {}

	public openLink(link: string) {
		switch (link) {
			case 'EVER':
				this._electronService.shell.openExternal('https://ever.co');
				break;
			case 'TOS':
				this._electronService.shell.openExternal(
					'https://gauzy.co/tos'
				);
				break;
			case 'PRIVACY':
				this._electronService.shell.openExternal(
					'https://gauzy.co/privacy'
				);
				break;
			default:
				break;
		}
	}

	public get application() {
		this._application = {
			name: this._electronService.remote.app
				.getName()
				.split('-')
				.join(' ')
				.replace(/(^\w{1})|(\s+\w{1})/g, (letter) =>
					letter.toUpperCase()
				),
			version: this._electronService.remote.app.getVersion(),
			iconPath: './assets/icons/icon_512x512.png'
		};
		return this._application;
	}
}
