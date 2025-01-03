import { IBaseEntityModel } from './base-entity.model';

export interface IChangelog extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	isFeature?: boolean;
	learnMoreUrl?: string;
	imageUrl?: string;
}

export interface IChangelogCreateInput extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	isFeature?: boolean;
	learnMoreUrl?: string;
	imageUrl?: string;
}

export interface IChangelogFindInput extends IBaseEntityModel {
	date?: string;
	isFeature?: boolean | number;
}

export interface IChangelogUpdateInput extends IChangelogCreateInput {
	id: string;
}
