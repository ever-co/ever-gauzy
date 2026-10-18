import { IntegrationEntity } from '@gauzy/contracts';

/** How an entity syncs (plan 02 §1). */
export type EverWorksDirection = 'both' | 'ew_to_gauzy' | 'gauzy_to_ew' | 'suggest' | 'link_only' | 'off';

export const EVER_WORKS_DIRECTIONS: ReadonlyArray<EverWorksDirection> = ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'suggest', 'link_only', 'off'];

/** The synced domains and the directions each one may take. */
export const EVER_WORKS_DOMAINS = {
	members: ['suggest', 'off'],
	agents: ['ew_to_gauzy', 'off'],
	teams: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	works: ['link_only', 'off'],
	missions: ['ew_to_gauzy', 'both', 'off'],
	goals: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	ideas: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	tasks: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	inbox: ['ew_to_gauzy', 'off'],
	docs: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off'],
	/** The read-only mirror of Ever Works agent mail into the Gauzy Inbox (plan 04 §6, optional). */
	agentEmail: ['off', 'ew_to_gauzy']
} as const satisfies Record<string, ReadonlyArray<EverWorksDirection>>;

export type EverWorksDomain = keyof typeof EVER_WORKS_DOMAINS;

/** Default entity directions (plan 02 §1). */
export const DEFAULT_EVER_WORKS_DIRECTIONS: Record<EverWorksDomain, EverWorksDirection> = {
	members: 'suggest',
	agents: 'ew_to_gauzy',
	teams: 'both',
	works: 'link_only',
	missions: 'ew_to_gauzy',
	goals: 'both',
	ideas: 'both',
	tasks: 'both',
	inbox: 'ew_to_gauzy',
	docs: 'both',
	agentEmail: 'off'
};

/**
 * The `integration_entity_setting` rows of a mapping (the per-entity `sync` toggles every Gauzy
 * integration has), all on by default; the direction of each domain is the `ENTITY_DIRECTIONS` setting, and a
 * toggle set to `sync: false` turns its domains off (`EVER_WORKS_ENTITY_DOMAINS`).
 */
export const EVER_WORKS_SYNCED_ENTITIES: ReadonlyArray<IntegrationEntity> = [
	IntegrationEntity.EMPLOYEE,
	IntegrationEntity.AGENT,
	IntegrationEntity.ORGANIZATION_TEAM,
	IntegrationEntity.PROJECT,
	IntegrationEntity.STRATEGIC_INITIATIVE,
	IntegrationEntity.GOAL,
	IntegrationEntity.KEY_RESULT,
	IntegrationEntity.TASK,
	IntegrationEntity.COMMENT,
	IntegrationEntity.INBOX_ITEM,
	IntegrationEntity.DOCUMENT
];

/**
 * The domains a per-entity `sync: false` turns off (owner decision OQ4, review F77): the toggle acts as direction
 * `off` for every domain that writes that Gauzy entity, in both directions, live, in the initial sync and in a
 * resync. A missing row is `sync: true`, so a mapping without toggles keeps its directions.
 *
 * - `TASK` also turns off `ideas` (an idea is a Gauzy task of the "Idea" issue type), and `INBOX_ITEM` also turns off
 *   `agentEmail` (the agent mail mirror writes Inbox items).
 * - `KEY_RESULT` and `COMMENT` have no domain of their own: `false` stops only those records. Goals keep syncing
 *   without their key results (no key result is written in Gauzy, no sample is pushed, and a goal push leaves the
 *   Ever Works criteria, metric and Definition of Done as they are); tasks keep syncing without their comments.
 */
export const EVER_WORKS_ENTITY_DOMAINS: Readonly<Partial<Record<IntegrationEntity, ReadonlyArray<EverWorksDomain>>>> = {
	[IntegrationEntity.EMPLOYEE]: ['members'],
	[IntegrationEntity.AGENT]: ['agents'],
	[IntegrationEntity.ORGANIZATION_TEAM]: ['teams'],
	[IntegrationEntity.PROJECT]: ['works'],
	[IntegrationEntity.STRATEGIC_INITIATIVE]: ['missions'],
	[IntegrationEntity.GOAL]: ['goals'],
	[IntegrationEntity.TASK]: ['tasks', 'ideas'],
	[IntegrationEntity.INBOX_ITEM]: ['inbox', 'agentEmail'],
	[IntegrationEntity.DOCUMENT]: ['docs']
};

/** The per-entity `sync` toggles of a mapping as stored: `false` for an entity that is not synced; missing is on. */
export type EverWorksEntitySync = Partial<Record<IntegrationEntity, boolean>>;

/** The directions that take effect: the stored ones, with every domain of an entity whose toggle is off set to `off`. */
export function effectiveDirections(
	directions: Record<EverWorksDomain, EverWorksDirection>,
	entitySync: EverWorksEntitySync | null | undefined
): Record<EverWorksDomain, EverWorksDirection> {
	const effective = { ...directions };
	for (const [entity, domains] of Object.entries(EVER_WORKS_ENTITY_DOMAINS) as Array<[IntegrationEntity, ReadonlyArray<EverWorksDomain>]>) {
		if (entitySync?.[entity] !== false) continue;
		for (const domain of domains) effective[domain] = 'off';
	}
	return effective;
}

/** Whether a mapping syncs an entity: only a stored `sync: false` stops it. */
export function entitySynced(context: { entitySync?: EverWorksEntitySync | null }, entity: IntegrationEntity): boolean {
	return context.entitySync?.[entity] !== false;
}

/** The seeded issue type of Ideas (plan 01 §8). `value` follows the platform's spelling ('Bug', 'Story', …). */
export const EVER_WORKS_IDEA_ISSUE_TYPE = {
	name: 'Idea',
	value: 'Idea',
	description: '💡 An idea: a proposal that may become work. Ideas sync with Ever Works ideas; accepting and building them stays in Ever Works.',
	icon: 'task-issue-types/memo.svg',
	color: '#F5B700'
} as const;

/** The seeded saved view of Ideas (plan 01 §8). */
export const EVER_WORKS_IDEAS_VIEW = {
	name: 'Ideas',
	description: 'Tasks of the issue type Idea (synced with Ever Works ideas).'
} as const;

/** The projects created when needed (plan 06 G-P1-4). */
export const EVER_WORKS_DEFAULT_PROJECT_NAME = 'Ever Works';
export const EVER_WORKS_IDEAS_PROJECT_NAME = 'Ever Works — Ideas';
