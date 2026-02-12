import { inject, Injectable } from '@angular/core';
import { ElectronService } from '../electron/services';

@Injectable({
	providedIn: 'root'
})
export class GauzyStorageService {
	public readonly electronService = inject(ElectronService);

	public async getItem(key: string) {
		return this.electronService.invoke('akita::storage::getItem', key);
	}

	public async setItem(key: string, value: any) {
		this.electronService.invoke('akita::storage::setItem', { key, value });
	}

	public async removeItem(key: string) {
		this.electronService.invoke('akita::storage::removeItem', key);
	}

	public async clear() {
		this.electronService.invoke('akita::storage::clear');
	}
}
