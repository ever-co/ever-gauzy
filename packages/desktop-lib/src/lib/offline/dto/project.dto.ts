import { BaseTO } from './base.dto';

export interface ProjectTO extends BaseTO {
	contactId: string;
	description: string;
	imageUrl?: string;
	name: string;
	organizationContactId?: string;
}
export const TABLE_NAME_PROJECTS = 'projects';
