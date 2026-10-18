/**
 * The `integration_setting` names of an Ever Works `integration_tenant` (one per mapped Gauzy
 * organization, plan 06 G-P1-4). Persisted names are stable. None of them is a secret: the integration
 * key and the webhook signing secret live encrypted on `ever_works_connection`, never here (setting
 * values are stored in plaintext).
 */
export enum EverWorksSettingName {
	/** The `ever_works_connection` this organization syncs through. */
	CONNECTION_ID = 'CONNECTION_ID',
	/** The paired Ever Works organization. */
	EVER_WORKS_ORGANIZATION_ID = 'EVER_WORKS_ORGANIZATION_ID',
	EVER_WORKS_ORGANIZATION_SLUG = 'EVER_WORKS_ORGANIZATION_SLUG',
	/** JSON `{ [entity]: 'both' | 'ew_to_gauzy' | 'gauzy_to_ew' | 'suggest' | 'link_only' | 'off' }`. */
	ENTITY_DIRECTIONS = 'ENTITY_DIRECTIONS',
	/** Where synced tasks without a linked project land, and where Ideas land. */
	DEFAULT_PROJECT_ID = 'DEFAULT_PROJECT_ID',
	IDEAS_PROJECT_ID = 'IDEAS_PROJECT_ID',
	/** The Docs folder synced Ever Works documents land in (P3). */
	DOCS_ROOT_FOLDER_ID = 'DOCS_ROOT_FOLDER_ID',
	/**
	 * The root folder the synced tree (`Organization/`, `Works/`) was last placed under. When the docs root changes
	 * (OQ5), the sync moves the tree from this folder to the new root, then records the new one.
	 */
	DOCS_TREE_ROOT_ID = 'DOCS_TREE_ROOT_ID',
	/** While the synced tree moves to a new root (OQ5): that root, so a move cut short is finished (or turned) later. */
	DOCS_TREE_MOVING_TO = 'DOCS_TREE_MOVING_TO',
	/** Include flags (plan 06 G-P1-4). */
	INCLUDE_HIDDEN_TASKS = 'INCLUDE_HIDDEN_TASKS',
	INCLUDE_TRIAGE_TASKS = 'INCLUDE_TRIAGE_TASKS',
	INCLUDE_GOAL_ITERATION_KEY_RESULTS = 'INCLUDE_GOAL_ITERATION_KEY_RESULTS',
	/** Sync tasks of projects that are not linked to a Work (default on, plan 03 §C.2). */
	SYNC_UNLINKED_PROJECT_TASKS = 'SYNC_UNLINKED_PROJECT_TASKS',
	/** The seeded "Idea" issue type and "Ideas" task view of the organization. */
	IDEA_ISSUE_TYPE_ID = 'IDEA_ISSUE_TYPE_ID',
	IDEAS_TASK_VIEW_ID = 'IDEAS_TASK_VIEW_ID',
	/** Initial-sync checkpoint (plan 03 §C.6). */
	INITIAL_SYNC_STATE = 'INITIAL_SYNC_STATE',
	/**
	 * JSON array of Ever Works user ids an admin unpaired after Ever ID paired them automatically (plan 01 §3): they are
	 * not paired again by Ever ID alone, only suggested, until an admin pairs them.
	 */
	PEOPLE_EVER_ID_DECLINED = 'PEOPLE_EVER_ID_DECLINED',
	/** The integration's on/off flag under the spelling every Gauzy integration uses. */
	IS_ENABLED = 'IS_ENABLED'
}
