export interface IKbMouseActivityService<T> {
	save(activities: T): Promise<void>;
	retrieve(): Promise<T>;
	remove(): Promise<void>;
	update(activities: Partial<T>): Promise<void>;
}
