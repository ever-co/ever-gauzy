export interface ISelector<T> {
	hasPermission: boolean;
	selected: T;
	data: T[];
}
