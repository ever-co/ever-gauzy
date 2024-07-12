import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { IPlugin } from './plugin-loader.service';

@Injectable({
	providedIn: 'root'
})
export class PluginElectronService {
	private electronService = inject(ElectronService);

	public get plugins(): Promise<IPlugin[]> {
		return this.electronService.ipcRenderer.invoke('plugins::getAll');
	}

	public plugin(name: string): Promise<IPlugin> {
		return this.electronService.ipcRenderer.invoke('plugins::getOne', { name });
	}

	public activate(plugin: IPlugin) {
		this.electronService.ipcRenderer.send('plugin::activate', plugin);
	}

	public load() {
		this.electronService.ipcRenderer.send('plugin::load');
	}

	public deactivate(plugin: IPlugin) {
		this.electronService.ipcRenderer.send('plugin::deactivate', plugin);
	}

	public downloadAndInstall<T>(config: T) {
		this.electronService.ipcRenderer.send('plugin::download', config);
	}

	public uninstall(plugin: IPlugin) {
		this.electronService.ipcRenderer.send('plugin::uninstall', plugin);
	}

	public get status(): Observable<{ status: string; message?: string }> {
		return new Observable((observer) => {
			this.electronService.ipcRenderer.on('plugin::status', (_, arg) => {
				observer.next(arg);
				observer.complete();
			});
		});
	}
}
