import { IConfig, IStoreService } from '../types';
import { StoreService } from './store.service';

export class ConfigStoreService extends StoreService implements IStoreService<IConfig> {
	private readonly storeKey = 'configs';

	public setDefault(): void {
		if (this.find()) {
			return;
		}

		const defaultConfig: IConfig = {
			isLocalServer: false,
			isSetup: false,
			port: 8080,
			serverUrl: '',
			autoStart: true,
			secureProxy: {
				secure: true,
				enable: false,
				ssl: { key: '', cert: '' }
			}
		};

		this.store.set(this.storeKey, defaultConfig);
	}

	public update(values: Partial<IConfig>): void {
		const current = this.find() || {};
		this.store.set(this.storeKey, { ...current, ...values });
	}

	public find(): IConfig | undefined {
		return this.store.get(this.storeKey);
	}
}
