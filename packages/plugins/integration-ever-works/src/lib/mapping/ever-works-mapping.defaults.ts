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
	docs: ['both', 'ew_to_gauzy', 'gauzy_to_ew', 'off']
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
	docs: 'both'
};

/**
 * The `integration_entity_setting` rows of a mapping (the per-entity `sync` toggles every Gauzy
 * integration has), all on by default; the direction of each domain is the `ENTITY_DIRECTIONS` setting.
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
