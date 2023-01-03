import { BaseTO } from './base.dto';

export interface clientTO extends BaseTO {
	imageUrl: string;
	name: string;
}

export const TABLE_NAME_CLIENTS = 'clients';
