import { IAuth, IStoreService } from '../types';
import { StoreService } from './store.service';

export class AuthStoreService extends StoreService implements IStoreService<IAuth> {
	private readonly storeKey = 'auth';

	public setDefault(): void {
		if (this.find()) {
			return;
		}

		const defaultAuth: IAuth = {
			isLogout: true,
			allowScreenshotCapture: true
		};

		this.store.set(this.storeKey, defaultAuth);
	}

	public update(values: Partial<IAuth>): void {
		const current = this.find() || {};
		this.store.set(this.storeKey, { ...current, ...values });
	}

	public find(): IAuth | undefined {
		return this.store.get(this.storeKey);
	}
}
