export const TABLE_NAME_INTERVAL = 'intervals';

export interface IInterval {
	id: string;
	timerId: string;
	startAt: Date;
	endAt: Date;
	synced: boolean;
}
