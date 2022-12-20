export interface ProjectTO {
	id?: number;
	contactId: string;
	description: string;
	externalId: string;
	imageUrl?: string;
	name: string;
}
export const TABLE_NAME_PROJECTS = 'projects';
