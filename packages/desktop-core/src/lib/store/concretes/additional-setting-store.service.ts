import { IAdditionalSetting, IStoreService } from '../types';
import { StoreService } from './store.service';

export class AdditionalSettingStoreService extends StoreService implements IStoreService<IAdditionalSetting> {
	private readonly storeKey = 'additionalSetting';

	public setDefault(): void {
		// No-op
	}

	public update(values: Partial<IAdditionalSetting>): void {
		const current = this.find() || {};
		this.store.set(this.storeKey, { ...current, ...values });
	}

	public find(): IAdditionalSetting | undefined {
		const addSetting = this.store.get(this.storeKey);
		const values = {};
		if (addSetting) {
			Object.keys(addSetting).forEach((value) => {
				if (addSetting[value]) {
					values[value] = addSetting[value];
				}
			});
		}
		return values;
	}
}
