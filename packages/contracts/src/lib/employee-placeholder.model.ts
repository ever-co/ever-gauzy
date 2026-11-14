import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IInvite, InvitationExpirationEnum } from './invite.model';

/**
 * A member without an account (a placeholder): created with a name and, optionally, an email, by the people who may
 * add members. The person gets no email, has no password and no sign-in, and never runs a timer; their time counts in
 * reports like any member's until they claim it or an admin merges it into a member with an account.
 */
export interface IEmployeePlaceholderMemberInput {
	firstName: string;
	lastName?: string;
	/** Kept on the member to show it and to invite the person to claim their time later. Never a login. */
	email?: string;
}

/** Creates one member without an account in an organization, optionally in some of its teams. */
export interface IEmployeePlaceholderCreateInput
	extends IBasePerTenantAndOrganizationEntityModel, IEmployeePlaceholderMemberInput {
	/** Teams of the organization the member joins. */
	teamIds?: ID[];
}

/** Creates many members without an account at once, for an import. */
export interface IEmployeePlaceholderBulkCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	members: IEmployeePlaceholderMemberInput[];
	/** Teams of the organization every member joins. */
	teamIds?: ID[];
}

/** One row of a bulk creation, in the order of the input. */
export interface IEmployeePlaceholderBulkCreateItem {
	/** The member the row stands for: the new placeholder, or the member of the organization who already had the email. */
	employee: IEmployee;
	/** True when this call created the member; false when a member of the organization already had this email. */
	created: boolean;
}

export interface IEmployeePlaceholderBulkCreateResult {
	items: IEmployeePlaceholderBulkCreateItem[];
}

/** Sends a claim invitation for a member without an account. */
export interface IEmployeePlaceholderClaimInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Where the invitation goes. */
	email: string;
	/** The page of the app that accepts the invitation; it receives the email and the invitation code. */
	callbackUrl?: string;
	invitationExpirationPeriod?: InvitationExpirationEnum;
}

/** What moves from a member without an account to a member with one, when it is claimed or merged. */
export interface IEmployeePlaceholderTransferSummary {
	/** Time entries. */
	timeLogs: number;
	/** Seconds of those entries. */
	duration: number;
	timesheets: number;
	taskAssignments: number;
	/** The teams the member without an account belongs to. */
	teams: { id: ID; name: string }[];
}

/** What a merge would move, read before the admin confirms it. */
export interface IEmployeePlaceholderMergePreview extends IEmployeePlaceholderTransferSummary {
	placeholderEmployeeId: ID;
	targetEmployeeId: ID;
	/** Entries of the member without an account that overlap entries of the member it would be merged into. */
	overlappingTimeLogs: number;
}

/** Merges a member without an account into a member of the same organization who has an account. */
export interface IEmployeePlaceholderMergeInput extends IBasePerTenantAndOrganizationEntityModel {
	targetEmployeeId: ID;
}

export interface IEmployeePlaceholderMergeResult extends IEmployeePlaceholderTransferSummary {
	/** The member who now holds the time. */
	targetEmployeeId: ID;
}

/** The invitation a claim sends. */
export type IEmployeePlaceholderClaimResult = IInvite;
