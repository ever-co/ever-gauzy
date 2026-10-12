/**
 * Port for creating a Gauzy workspace whose owner is already linked to an Ever ID.
 *
 * Declared now so the provisioning route that will consume it can depend on a stable contract. The
 * implementation is part of that route's work: until it exists nothing provides this token, and no
 * code path of this plugin creates an account without the person confirming it.
 */
export interface CreateUserPreLinkedInput {
	issuer: string;
	subject: string;
	everPersonId?: string;
	email: string;
	firstName?: string;
	lastName?: string;
	tenant: { name: string };
	organization: { name: string; country?: string; currency?: string };
	everOrgId: string;
	everTenantId: string;
	handle: string;
	tenantLinkId?: string;
	options: { createEmployee: boolean };
	/** Replays with the same key return the ids of the first call. */
	idempotencyKey: string;
}

export interface CreateUserPreLinkedResult {
	userId: string;
	tenantId: string;
	organizationId: string;
	employeeId?: string;
}

export interface ZitadelProvisionerPort {
	createUserPreLinked(input: CreateUserPreLinkedInput): Promise<CreateUserPreLinkedResult>;
}

/** Injection token of {@link ZitadelProvisionerPort}. */
export const ZITADEL_PROVISIONER = 'ZITADEL_PROVISIONER';
