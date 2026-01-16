import { IBasePerTenantAndOrganizationEntityModel, ID, OmitFields } from './base-entity.model';
import { IEmployee, IEmployeeEntityInput } from './employee.model';
import { IGoal } from './goals.model';
import { IOrganizationProject } from './organization-projects.model';

// =====================================================
// ENUMS
// =====================================================

/**
 * Strategic state enum
 * Defines the lifecycle phase of a strategic initiative
 *
 * Lifecycle:
 * 1. DRAFT - Strategic intent is being articulated
 * 2. ACTIVE - Leadership validated, projects are being aligned
 * 3. RESOLVED - Strategy fulfilled its purpose
 * 4. RETIRED - Strategy discontinued or transformed
 */
export enum StrategicStateEnum {
	DRAFT = 'draft',
	ACTIVE = 'active',
	RESOLVED = 'resolved',
	RETIRED = 'retired'
}

/**
 * Visibility scope enum
 * Defines who can see the strategic initiative
 *
 * - LEADERSHIP: Only organization admins/managers
 * - ORGANIZATION: All organization members
 * - TEAM: Members of teams linked to associated projects
 */
export enum VisibilityScopeEnum {
	LEADERSHIP = 'leadership',
	ORGANIZATION = 'organization',
	TEAM = 'team'
}

/**
 * Confidence level enum
 * Qualitative signal for strategic confidence
 */
export enum ConfidenceLevelEnum {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high'
}

/**
 * Perceived momentum enum
 * Qualitative signal for strategic progress perception
 */
export enum PerceivedMomentumEnum {
	STALLED = 'stalled',
	PROGRESSING = 'progressing',
	ACCELERATING = 'accelerating'
}

// =====================================================
// INTERFACES - Strategic Signals
// =====================================================

/**
 * Strategic signals interface
 * Qualitative signals stored as structured metadata
 *
 * These are:
 * - Optional
 * - Human-authored
 * - NOT derived automatically from project data
 */
export interface IStrategicSignals {
	/** Overall confidence in achieving strategic intent */
	confidenceLevel?: ConfidenceLevelEnum;

	/** Perceived momentum of progress */
	perceivedMomentum?: PerceivedMomentumEnum;

	/** List of known risks or blockers */
	knownRisks?: string[];

	/** Free-form strategic notes */
	strategicNotes?: string;

	/** Last assessment date */
	lastAssessedAt?: Date;

	/** ID of employee who made the last assessment */
	lastAssessedById?: ID;
}

// =====================================================
// INTERFACES - Relational
// =====================================================

/**
 * Relational interface for entities that reference a strategic initiative
 */
export interface IRelationalStrategicInitiative {
	strategicInitiative?: IStrategicInitiative;
	strategicInitiativeId?: ID;
}

// =====================================================
// INTERFACES - Main Entity
// =====================================================

/**
 * Strategic Initiative interface
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
export interface IStrategicInitiative
	extends IBasePerTenantAndOrganizationEntityModel,
		IEmployeeEntityInput {
	/** Short, human-readable title */
	title: string;

	/** Long-form description of the strategic intent */
	intent?: string;

	/** Current lifecycle state */
	state: StrategicStateEnum;

	/** Who can see this initiative */
	visibilityScope: VisibilityScopeEnum;

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
	signals?: IStrategicSignals | string // String for SQLite compatibility;

	/**
	 * Projects aligned with this initiative
	 * Note: Projects reference initiatives, not the reverse
	 * This is the inverse side of the relationship
	 * Typed as generic to avoid circular dependencies
	 * @see Section 5 of conceptual analysis
	 */
	projects?: IOrganizationProject[];

	/**
	 * Goals aligned with this initiative (optional)
	 * Provides strategic context to OKR measurements
	 * Typed as generic to avoid circular dependencies
	 */
	goals?: IGoal[];
}

// =====================================================
// INTERFACES - Input/Output
// =====================================================

/**
 * Create input for strategic initiative
 */
export interface IStrategicInitiativeCreateInput
	extends OmitFields<IStrategicInitiative, 'projects' | 'goals' | 'steward' | 'employee'> {
	stewardId?: ID;
}

/**
 * Update input for strategic initiative
 */
export interface IStrategicInitiativeUpdateInput
	extends Partial<OmitFields<IStrategicInitiative, 'projects' | 'goals' | 'steward' | 'employee'>> {
	stewardId?: ID;
}

/**
 * Update input specifically for strategic signals
 */
export interface IStrategicSignalsUpdateInput extends Partial<IStrategicSignals> {}

/**
 * Find input for strategic initiatives
 */
export interface IStrategicInitiativeFindInput
	extends Partial<
		Pick<IStrategicInitiative, 'state' | 'visibilityScope' | 'stewardId' | 'isActive' | 'isArchived'>
	> {
	/** Filter by title (partial match) */
	title?: string;
}
