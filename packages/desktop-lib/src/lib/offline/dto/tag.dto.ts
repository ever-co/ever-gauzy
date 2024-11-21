import { BaseTO } from './base.dto';

export interface TagTO extends BaseTO {
	color: string;
	name: string;
}

export const TABLE_NAME_TAGS = 'tags';