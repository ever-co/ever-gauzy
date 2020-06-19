import { Component, OnInit } from '@angular/core';
import { ElectronService } from 'ngx-electron';

@Component({
	selector: 'ngx-setup',
	templateUrl: './setup.component.html',
	styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit {
	constructor(private electronService: ElectronService) {}
	defaultToggle: Boolean = false;
	isDefauValue: Boolean = false;
	loading: Boolean = false;
	serverOption: any = [
		{
			id: 'local',
			name: 'Local'
		},
		{
			id: 'live',
			name: 'Live'
		}
	];

	databaseOption: any = [
		{
			id: 'sqlite',
			name: 'SQLITE'
		},
		{
			id: 'postgres',
			name: 'postgreSQL'
		}
	];

	defaultPlaceholder: any = {
		dbHost: 'DB Host',
		dbPort: 'DB Port',
		dbName: 'DB Name',
		dbUser: 'DB User',
		dbPassword: 'DB Password',
		serverPort: 'Server Port',
		serverUrl: 'Server Url'
	};

	tempPlaceholder: any = {};

	defaultValue: any = {
		dbHost: 'localhost',
		dbPort: '5433',
		dbName: 'postgres',
		dbUser: 'postgres',
		dbPassword: 'postgres',
		serverPort: '3000',
		serverUrl: 'http://localhost:3000'
	};

	isLocalServer: Boolean = false;
	isLiveServer: Boolean = false;
	isPostgres: Boolean = false;
	setup: any = {
		dbUser: '',
		dbPassword: ''
	};
	selectedServer: String = null;
	selectedDatabase: String = null;

	onServerChange(event) {
		this.defaultToggle = true;
		switch (event) {
			case 'local':
				{
					this.isLocalServer = true;
					this.isLiveServer = false;
				}
				break;
			case 'live':
				{
					this.isLocalServer = false;
					this.isLiveServer = true;
				}
				break;
			default:
				this.isLocalServer = false;
		}
	}

	onDatabaseChange(event) {
		switch (event) {
			case 'postgres':
				this.isPostgres = true;
				break;
			case 'sqlite':
				this.isPostgres = false;
				break;
			default:
				this.isPostgres = false;
		}
	}

	saveConfiguration() {
		this.loading = true;
		let data: any = {
			isLocalServer: this.isLocalServer,
			port: this.isLocalServer
				? this.setup.serverPort || this.defaultValue.serverPort
				: null,
			db: this.selectedDatabase,
			serverUrl: this.isLiveServer
				? this.setup.serverUrl || this.defaultValue.serverUrl
				: null
		};
		if (this.selectedDatabase && this.isLocalServer) {
			data = {
				...data,
				dbHost: this.setup.dbHost || this.defaultValue.dbHost,
				dbPort: this.setup.dbPort || this.defaultValue.dbPort,
				dbName: this.setup.dbName || this.defaultValue.dbName,
				dbUsername: this.setup.dbUSer || this.defaultValue.dbUser,
				dbPassword:
					this.setup.dbPassword || this.defaultValue.dbPassword
			};
		}

		this.electronService.ipcRenderer.send('go', data);
	}

	inputFocus(event) {
		const field = event.target.id;
		this.tempPlaceholder[field] = this.defaultPlaceholder[field];
		this.defaultPlaceholder[field] = this.defaultValue[field];
	}

	inOutFocus(event) {
		const field = event.target.id;
		this.defaultPlaceholder[field] = this.tempPlaceholder[field];
	}

	onSwitch() {
		this.isDefauValue = !this.isDefauValue;
		if (this.isDefauValue) {
			this.setup = {
				...this.defaultValue
			};
		} else {
			this.setup = {};
		}
	}

	ngOnInit(): void {}
}
