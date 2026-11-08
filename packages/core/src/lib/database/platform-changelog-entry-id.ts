import { v5 as uuidV5 } from 'uuid';

// Outside migrations/ on purpose: TypeORM takes every exported function of a migration file as a migration class, and
// `platformChangelogEntryId` there stopped the api and worker from booting ("migration name is wrong", develop 93de1d6).

/** The fixed namespace of the starter entries' ids. Never change it: the ids are what makes a rerun a no-op. */
export const PLATFORM_CHANGELOG_ID_NAMESPACE = '4a00d5da-0335-4667-95c1-035b7b541c0f';

/**
 * The id of a starter entry: a UUID v5 of `platform/title`, the same in every run and on every database. Two API
 * processes booting together can both pass the title check (each sees only its own uncommitted rows, and the
 * MySQL lock is released when `up` returns, before the migration's transaction commits); the second insert of an
 * id then conflicts and is ignored instead of adding a copy.
 */
export function platformChangelogEntryId(platform: string, title: string): string {
	return uuidV5(`${platform}/${title}`, PLATFORM_CHANGELOG_ID_NAMESPACE);
}
