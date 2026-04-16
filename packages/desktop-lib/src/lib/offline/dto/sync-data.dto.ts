export interface SyncLogTO {
	id?: number;
	payload?: string;
	status?: string;
	key?: string;
	createdAt?: Date;
	errorMessage?: string;
	response?: string;
}

export const TABLE_NAME_SYNC_LOG: string = 'desktop_synchronize_log';
