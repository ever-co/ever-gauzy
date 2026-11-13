import { IBaseEntityModel } from './base-entity.model';

/**
 * The products whose news the changelog carries. One installation's `changelog` table can feed several
 * products: Ever Teams runs on the Gauzy API (the Ever Teams API shares its database with Gauzy's), and
 * other Ever products read their "What's new" entries from the same public endpoint. Every entry names the
 * product it belongs to, and every reader asks for its own product's entries only.
 *
 * Any lowercase key matching {@link CHANGELOG_PLATFORM_PATTERN} is accepted, so a new product needs no API
 * release; these are the ones the platform knows by name.
 */
export enum ChangelogPlatformEnum {
	GAUZY = 'gauzy',
	EVER_TEAMS = 'ever-teams',
	EVER_WORKS = 'ever-works',
	EVER_PLATFORM = 'ever-platform'
}

/** The product an entry belongs to when none is named: every entry written before products existed is Gauzy's. */
export const DEFAULT_CHANGELOG_PLATFORM: string = ChangelogPlatformEnum.GAUZY;

/** The longest product key the `changelog.platform` column holds. */
export const CHANGELOG_PLATFORM_MAX_LENGTH = 50;

/** A product key: lowercase letters, digits and inner hyphens, such as `ever-teams`. */
export const CHANGELOG_PLATFORM_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface IChangelog extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	isFeature?: boolean;
	learnMoreUrl?: string;
	imageUrl?: string;
	/** The product the entry belongs to (see {@link ChangelogPlatformEnum}); `gauzy` when not named. */
	platform?: string;
}

export interface IChangelogCreateInput extends IBaseEntityModel {
	icon?: string;
	title?: string;
	date?: Date;
	content?: string;
	isFeature?: boolean;
	learnMoreUrl?: string;
	imageUrl?: string;
	/** The product the entry belongs to; `gauzy` when not named. */
	platform?: string;
}

export interface IChangelogFindInput extends IBaseEntityModel {
	date?: string;
	isFeature?: boolean | number;
	/** The product whose entries to list; `gauzy` when not named. */
	platform?: string;
}

export interface IChangelogUpdateInput extends IChangelogCreateInput {
	id: string;
}
