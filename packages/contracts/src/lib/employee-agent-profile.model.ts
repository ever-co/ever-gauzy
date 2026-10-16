import { ID, IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

/**
 * The lifecycle state of an agent, as its source system reports it (for Ever Works: draft, active,
 * running, paused, error, archived). Stored as a string, so a source may report a state this list does
 * not name yet.
 */
export enum EmployeeAgentStatusEnum {
	DRAFT = 'draft',
	ACTIVE = 'active',
	RUNNING = 'running',
	PAUSED = 'paused',
	ERROR = 'error',
	ARCHIVED = 'archived'
}

/** Where an agent profile comes from. Integrations add their own value; `ever_works` is the first one. */
export enum EmployeeAgentSourceEnum {
	EVER_WORKS = 'ever_works'
}

/**
 * The agent-specific facts of an agent employee (`employee.kind = 'agent'`), one row per employee.
 *
 * The employee row carries everything an employee has in common with a person (name through its user,
 * team and task membership, mentions); this row carries what only an agent has: the system it is
 * managed by and its identifier there, its capabilities, model and runtime status.
 */
export interface IEmployeeAgentProfile extends IBasePerTenantAndOrganizationEntityModel {
	/** The agent employee this profile belongs to (unique: one profile per employee). */
	employeeId: ID;
	employee?: IEmployee;
	/** The system the agent comes from, e.g. `ever_works`. */
	source: EmployeeAgentSourceEnum | string;
	/** The agent's identifier in its source system. */
	externalId?: string;
	/** The agent's slug in its source system. */
	slug?: string;
	/** The agent's title / role, e.g. "Backend engineer". */
	title?: string;
	/** What the agent can do, as its source system names it. */
	capabilities?: string[];
	/** The agent's runtime state, as its source system reports it. */
	status?: EmployeeAgentStatusEnum | string;
	/** The scope the agent works in (e.g. `organization`, `team`, `work`), as its source system names it. */
	scope?: string;
	/** The identifier of the scope's target (a team or work id in the source system). */
	scopeTargetId?: string;
	/** The employee this agent reports to, when there is one (a person or another agent). */
	reportsToEmployeeId?: ID;
	reportsToEmployee?: IEmployee;
	/** The model the agent runs on, as its source system names it. */
	modelId?: string;
	/** The agent's avatar, as its source system serves it. */
	avatarUrl?: string;
	/** When the agent last ran. */
	lastRunAt?: Date;
	/**
	 * Whether the agent is managed by its source system. A managed agent is read-only in Gauzy: its name and
	 * profile are changed in the source system and synced in.
	 */
	managedExternally?: boolean;
	/** The agent's page in its source system. */
	externalUrl?: string;
	/** Source-specific extras. */
	metadata?: Record<string, any>;
}

/** The profile fields an integration states when it provisions or updates an agent employee. */
export type IEmployeeAgentProfileInput = Omit<
	IEmployeeAgentProfile,
	'id' | 'employeeId' | 'employee' | 'reportsToEmployee' | 'tenantId' | 'tenant' | 'organizationId' | 'organization'
>;

/**
 * Input of `EmployeeService.createAgentEmployee`: everything needed to provision an agent employee. Used by
 * integrations only; there is no public route that takes it.
 */
export interface IAgentEmployeeCreateInput {
	tenantId: ID;
	organizationId: ID;
	/** The agent's display name. Stored as the user's first name (the last name stays empty). */
	name: string;
	/**
	 * The login identity of the agent's user. It must be under the RFC 2606 `.invalid` top-level domain, so
	 * nothing is ever delivered to it. Defaults to `agent-<random id>@agents.invalid`.
	 */
	email?: string;
	/** The agent's avatar. */
	imageUrl?: string;
	/** A one-line summary for the lists (`employee.short_description`), e.g. the agent's title. */
	shortDescription?: string;
	/** The agent profile to create with the employee. */
	profile?: IEmployeeAgentProfileInput;
}

/** The agent employee `createAgentEmployee` provisioned, with its profile. */
export interface IAgentEmployee {
	employee: IEmployee;
	profile: IEmployeeAgentProfile | null;
	/** `false` when an agent employee with this email already existed in the organization and was returned as is. */
	created: boolean;
}
