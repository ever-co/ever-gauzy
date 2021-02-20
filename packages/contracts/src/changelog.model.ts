import { IBaseEntityModel } from './base-entity.model';

export interface IChangelog extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	learnMoreUrl?: string;
}

export interface IChangelogCreateInput extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	learnMoreUrl?: string;
}

export interface IChangelogFindInput extends IBaseEntityModel {
	date?: string;
}

export interface IChangelogUpdateInput extends IChangelogCreateInput {
	id: string;
}
