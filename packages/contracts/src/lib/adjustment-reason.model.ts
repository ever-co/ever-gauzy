import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { AdjustmentType } from './adjustment.model';

/**
 * A governed reason code for a manual money movement.
 *
 * A manual adjustment is money leaving or entering the business without a document behind it, so it
 * must always be attributable to a reason an administrator maintains. The adjustment stores the
 * code as text; this row is what makes the code legitimate, narrows which adjustment types may cite
 * it, and records whether citing it requires approval.
 */
export interface IAdjustmentReason extends IBasePerTenantAndOrganizationEntityModel {
	/** Upper snake case code, unique per organization, for example `GOODWILL` or `PRICE_MATCH`. */
	code: string;

	/** Administrator-facing name. */
	label: string;

	/** Longer explanation of when the reason applies. */
	description?: string;

	/** Narrows which adjustment types may cite the reason; `MANUAL` applies to any type. */
	appliesTo: AdjustmentType;

	/** When true, an adjustment citing the code must be approved before it is applied. */
	requiresApproval: boolean;

	/** Seeded codes that a tenant may deactivate but not delete. */
	isSystem: boolean;

	/** Display order among the reasons of one organization. */
	sortOrder: number;

	/** Free-form payload. */
	metadata?: Record<string, unknown>;
}

/**
 * Input for creating or seeding an adjustment reason.
 */
export interface IAdjustmentReasonCreateInput
	extends Partial<Omit<IAdjustmentReason, 'id' | 'code' | 'label'>> {
	code: string;
	label: string;
}
