import { store } from '../electron-helpers';
import { IStore } from '../types';

export abstract class StoreService {
	protected store: IStore;

	constructor() {
		this.store = store;
	}
}
