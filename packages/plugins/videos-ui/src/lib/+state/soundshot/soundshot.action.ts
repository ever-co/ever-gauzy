import { ID } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';

export class SoundshotAction {
	public static fetchAll = createAction('[Soundshots] Fetch Soundshots', (params?: any) => ({ params }));
	public static fetchOne = createAction('[Soundshots] Fetch One Soundshot', (id: ID, params?: any) => ({
		id,
		params
	}));
	public static delete = createAction('[Soundshots] Delete Soundshot', (id: ID, params?: any) => ({ id, params }));
	public static hardDelete = createAction('[Soundshots] Hard Delete Soundshot', (id: ID, params: any) => ({
		id,
		params
	}));
	public static restore = createAction('[Soundshots] Restore Soundshot', (id: ID) => ({ id }));
	public static download = createAction('[Soundshots] Download Soundshot', (url: string) => ({ urls: [url] }));
}
