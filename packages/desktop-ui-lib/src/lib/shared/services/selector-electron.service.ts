import { Injectable } from '@angular/core';
import { ElectronService } from '../../electron/services';

@Injectable({
	providedIn: 'root'
})
export class SelectorElectronService {
	constructor(private readonly electronService: ElectronService) {}
	public refresh() {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public update<T>(config: T) {
		this.electronService.ipcRenderer.send('update_project_on', config);
	}
}
