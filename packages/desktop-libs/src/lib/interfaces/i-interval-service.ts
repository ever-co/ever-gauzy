export interface IIntervalService<T> {
	create(interval: T): Promise<void>;
	backedUpNoSynced(): Promise<T[]>;
	backedUpAllNoSynced(): Promise<T[]>;
	synced(interval: T): Promise<void>;
	destroy(interval: Partial<T>): Promise<void>;
	countNoSynced(): Promise<number>;
	screenshots(): Promise<any[]>;
}
