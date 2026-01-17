import { IBasePerTenantAndOrganizationEntityModel, ID, OmitFields } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IGoal } from './goals.model';
import { IOrganizationProject } from './organization-projects.model';

/**
 * Organization Strategic State enum
 * Defines the lifecycle phase of a strategic initiative
 *
 * Lifecycle:
 * 1. DRAFT - Strategic intent is being articulated
 * 2. ACTIVE - Leadership validated, projects are being aligned
 * 3. RESOLVED - Strategy fulfilled its purpose
 * 4. RETIRED - Strategy discontinued or transformed
 */
export enum OrganizationStrategicStateEnum {
	DRAFT = 'draft',
	ACTIVE = 'active',
	RESOLVED = 'resolved',
	RETIRED = 'retired'
}

/**
 * Organization Strategic Visibility scope enum
 * Defines who can see the strategic initiative
 *
 * - LEADERSHIP: Only organization admins/managers
 * - ORGANIZATION: All organization members
 * - TEAM: Members of teams linked to associated projects
 */
export enum OrganizationStrategicVisibilityScopeEnum {
	LEADERSHIP = 'leadership',
	ORGANIZATION = 'organization',
	TEAM = 'team'
}

/**
 * Organization Strategic Confidence level enum
 * Qualitative signal for strategic confidence
 */
export enum OrganizationStrategicConfidenceLevelEnum {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high'
}

/**
 * Organization Strategic Perceived momentum enum
 * Qualitative signal for strategic progress perception
 */
export enum OrganizationStrategicPerceivedMomentumEnum {
	STALLED = 'stalled',
	PROGRESSING = 'progressing',
	ACCELERATING = 'accelerating'
}

/**
 * Organization Strategic signals interface
 * Qualitative signals stored as structured metadata
 *
 * These are:
 * - Optional
 * - Human-authored
 * - NOT derived automatically from project data
 */
export interface IOrganizationStrategicSignals {
	/** Overall confidence in achieving strategic intent */
	confidenceLevel?: OrganizationStrategicConfidenceLevelEnum;

	/** Perceived momentum of progress */
	perceivedMomentum?: OrganizationStrategicPerceivedMomentumEnum;

	/** List of known risks or blockers */
	knownRisks?: string[];

	/** Free-form strategic notes */
	strategicNotes?: string;

	/** Last assessment date */
	lastAssessedAt?: Date;

	/** ID of employee who made the last assessment */
	lastAssessedById?: ID;
}

/**
 * Relational interface for entities that reference a single strategic initiative
 * Used for: Goals (ManyToOne relationship)
 */
export interface IRelationalOrganizationStrategicInitiative {
	organizationStrategicInitiative?: IOrganizationStrategicInitiative;
	organizationStrategicInitiativeId?: ID;
}

/**
 * Relational interface for entities that reference multiple strategic initiatives
 * Used for: Projects (ManyToMany relationship)
 *
 * A project can contribute to multiple strategic directions simultaneously.
 * Example: "Dashboard Redesign" project could align with:
 * - "Improve User Experience" initiative
 * - "Modernize Tech Stack" initiative
 */
export interface IRelationalOrganizationStrategicInitiatives {
	organizationStrategicInitiatives?: IOrganizationStrategicInitiative[];
}

/**
 * Organization Strategic Initiative interface
 *
 * A declared organizational focus area that gives meaning
 * and alignment to multiple projects over time.
 *
 * Key principles:
 * - Directional, not operational
 * - Long-lived, few in number
 * - Outcome-oriented, not task-based
 * - Cannot be "completed" by closing tasks
 *
 * @see Section 1-4 of conceptual analysis
 */
export interface IOrganizationStrategicInitiative
	extends IBasePerTenantAndOrganizationEntityModel {
	/** Short, human-readable title */
	title: string;

	/** Long-form description of the strategic intent */
	intent?: string;

	/** Current lifecycle state */
	state: OrganizationStrategicStateEnum;

	/** Who can see this initiative */
	visibilityScope: OrganizationStrategicVisibilityScopeEnum;

	/**
	 * Steward - owns the clarity of the strategy's intent
	 * Responsible for directional integrity, not delivery
	 * @see Section 6 of conceptual analysis
	 */
	steward?: IEmployee;
	stewardId?: ID;

	/**
	 * Qualitative strategic signals
	 * Stored as JSON, human-authored
	 * @see Section 9 of conceptual analysis
	 */
	signals?: IOrganizationStrategicSignals | string; // String for SQLite compatibility

	/**
	 * Projects aligned with this initiative
	 * Note: Projects reference initiatives, not the reverse
	 * This is the inverse side of the relationship
	 * @see Section 5 of conceptual analysis
	 */
	projects?: IOrganizationProject[];

	/**
	 * Goals aligned with this initiative (optional)
	 * Provides strategic context to OKR measurements
	 */
	goals?: IGoal[];
}

/**
 * Create input for organization strategic initiative
 */
export interface IOrganizationStrategicInitiativeCreateInput
	extends OmitFields<IOrganizationStrategicInitiative, 'projects' | 'goals' | 'steward'> {
	stewardId?: ID;
}

/**
 * Update input for organization strategic initiative
 */
export interface IOrganizationStrategicInitiativeUpdateInput
	extends Partial<OmitFields<IOrganizationStrategicInitiative, 'projects' | 'goals' | 'steward'>> {
	stewardId?: ID;
}

/**
 * Update input specifically for organization strategic signals
 */
export interface IOrganizationStrategicSignalsUpdateInput extends Partial<IOrganizationStrategicSignals> {}

/**
 * Find input for organization strategic initiatives
 */
export interface IOrganizationStrategicInitiativeFindInput
	extends Partial<
		Pick<IOrganizationStrategicInitiative, 'state' | 'visibilityScope' | 'stewardId' | 'isActive' | 'isArchived'>
	> {
	/** Filter by title (partial match) */
	title?: string;
}
