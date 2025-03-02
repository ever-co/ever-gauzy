import { IProject, IStoreService } from '../types';
import { StoreService } from './store.service';

export class ProjectStoreService extends StoreService implements IStoreService<IProject> {
	private readonly storeKey = 'project';

	public setDefault(): void {
		if (this.find()) {
			return;
		}

		const defaultProject: IProject = {
			aw: {
				isAw: true
			}
		};

		this.store.set(this.storeKey, defaultProject);
	}

	public update(values: Partial<IProject>): void {
		const current = this.find() || {};
		this.store.set(this.storeKey, { ...current, ...values });
	}

	public find(): IProject | undefined {
		return this.store.get(this.storeKey);
	}
}
