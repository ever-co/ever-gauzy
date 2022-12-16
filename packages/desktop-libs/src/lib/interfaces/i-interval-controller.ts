export interface IIntervalController<T> {
	create(interval: T): Promise<void>;
	backedUpNoSynced(): Promise<T[]>;
	destroy(interval: Partial<T>): Promise<void>;
	remove(interval: Partial<T>): Promise<void>;
	findBetweenTwoDates(startAt: Date, endAt: Date): Promise<T[]>;
}
