import { inject, Injectable } from '@angular/core';
import { ElectronService } from '../electron/services';

@Injectable({
	providedIn: 'root'
})
export class GauzyStorageService {
	private readonly electronService = inject(ElectronService);

	public async getItem(key: string): Promise<any> {
		return this.electronService.invoke('akita::storage::getItem', key);
	}

	public async setItem(key: string, value: any): Promise<void> {
		await this.electronService.invoke('akita::storage::setItem', { key, value });
	}

	public async removeItem(key: string): Promise<void> {
		await this.electronService.invoke('akita::storage::removeItem', key);
	}

	public async clear(): Promise<void> {
		await this.electronService.invoke('akita::storage::clear');
	}
}
