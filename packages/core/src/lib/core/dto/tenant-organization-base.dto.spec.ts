import '../entities/internal';

import { plainToInstance } from 'class-transformer';
import { useContainer, validate } from 'class-validator';
import { RequestContext } from '../context';
import { OrganizationBelongsToUserConstraint } from '../../shared/validators/constraints/organization-belongs-to-user.constraint';
import { TenantOrganizationBaseDTO } from './tenant-organization-base.dto';

jest.mock('../utils', () => ({
	...jest.requireActual('../utils'),
	getORMType: () => 'typeorm'
}));

/**
 * GHSA-44pv-34gx-q9p4 — `organization` and `organizationId` were each validated only when the OTHER was
 * absent (`@ValidateIf((it) => !it.organizationId && !it.sentTo)` and its mirror). A request that sent
 * BOTH therefore validated NEITHER, and `sentTo` switched both off on its own. Combined with the
 * membership validator accepting an organization object without an id, a caller could clear the
 * organization checks of every DTO built on this one while naming an organization of another tenant.
 *
 * The controls replay the old `ValidateIf` conditions on the same payloads.
 */

const TENANT_ID = '5c7d8e9f-0000-4000-8000-000000000001';
const USER_ID = '5c7d8e9f-0000-4000-8000-0000000000a1';
const OWN_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b1';
const SIBLING_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b2';
const FOREIGN_ORGANIZATION_ID = '5c7d8e9f-0000-4000-8000-0000000000b3';

const MEMBERSHIPS = [{ tenantId: TENANT_ID, userId: USER_ID, organizationId: OWN_ORGANIZATION_ID }];

/** Drops `undefined` keys from the criteria, the way TypeORM does before building the SQL. */
const findOneByOrFail = async (where: Record<string, any>) => {
	const criteria = Object.entries(where).filter(([, value]) => value !== undefined);
	const match = MEMBERSHIPS.find((row) => criteria.every(([key, value]) => (row as any)[key] === value));

	if (!match) {
		throw new Error('EntityNotFoundError');
	}
	return match;
};

/** The `@ValidateIf` conditions as they stood before the fix. */
const LEGACY_CONDITIONS = {
	organization: (it: any) => !it.organizationId && !it.sentTo,
	organizationId: (it: any) => !it.organization && !it.sentTo
};

describe('TenantOrganizationBaseDTO organization checks', () => {
	beforeAll(() => {
		// class-validator instantiates a constraint with `new` unless a container resolves it; the
		// constraint needs a repository, so resolve it here.
		useContainer(
			{
				get: (someClass: any) =>
					someClass === OrganizationBelongsToUserConstraint
						? new OrganizationBelongsToUserConstraint({ findOneByOrFail } as any, {} as any)
						: new someClass()
			},
			{ fallback: true, fallbackOnErrors: true }
		);
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	const failingProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
		const errors = await validate(plainToInstance(TenantOrganizationBaseDTO, payload));
		return errors.map((error) => error.property).sort();
	};

	it('accepts the shapes the clients send', async () => {
		await expect(failingProperties({ organizationId: OWN_ORGANIZATION_ID })).resolves.toEqual([]);
		await expect(failingProperties({ organization: { id: OWN_ORGANIZATION_ID } })).resolves.toEqual([]);
		// The invoice flows send the full organization next to its id; both name the same organization.
		await expect(
			failingProperties({ organizationId: OWN_ORGANIZATION_ID, organization: { id: OWN_ORGANIZATION_ID } })
		).resolves.toEqual([]);
		// `sentTo` alone (the received-invoices listing) still needs no organization.
		await expect(failingProperties({ sentTo: 'contact-1' })).resolves.toEqual([]);
		await expect(failingProperties({ sentTo: 'contact-1', organizationId: OWN_ORGANIZATION_ID })).resolves.toEqual(
			[]
		);
	});

	it('refuses an organization object that names no organization, next to any organizationId', async () => {
		await expect(
			failingProperties({ organizationId: OWN_ORGANIZATION_ID, organization: { isActive: true } })
		).resolves.toEqual(['organization']);
		await expect(failingProperties({ organizationId: OWN_ORGANIZATION_ID, organization: {} })).resolves.toEqual([
			'organization'
		]);
	});

	it('refuses an organization the caller is not a member of, whatever else the payload carries', async () => {
		await expect(failingProperties({ organizationId: FOREIGN_ORGANIZATION_ID })).resolves.toEqual([
			'organizationId'
		]);
		// The `sentTo` switch used to turn this check off entirely.
		await expect(
			failingProperties({ sentTo: 'contact-1', organizationId: FOREIGN_ORGANIZATION_ID })
		).resolves.toEqual(['organizationId']);
		await expect(
			failingProperties({
				organization: { id: FOREIGN_ORGANIZATION_ID },
				organizationId: FOREIGN_ORGANIZATION_ID
			})
		).resolves.toEqual(['organization', 'organizationId']);
	});

	it('requires the two fields to agree when both are sent', async () => {
		await expect(
			failingProperties({ organizationId: OWN_ORGANIZATION_ID, organization: { id: SIBLING_ORGANIZATION_ID } })
		).resolves.toEqual(['organization']);
	});

	it('still requires an organization when none of the three fields is given', async () => {
		await expect(failingProperties({})).resolves.toEqual(['organization', 'organizationId']);
	});

	it('CONTROL: the pre-fix conditions skipped BOTH validators on each payload refused above', () => {
		const payloads = [
			{ organizationId: OWN_ORGANIZATION_ID, organization: { isActive: true } },
			{ organizationId: OWN_ORGANIZATION_ID, organization: {} },
			{ organizationId: OWN_ORGANIZATION_ID, organization: { id: SIBLING_ORGANIZATION_ID } },
			{ organizationId: FOREIGN_ORGANIZATION_ID, organization: { id: FOREIGN_ORGANIZATION_ID } }
		];

		for (const payload of payloads) {
			expect(LEGACY_CONDITIONS.organization(payload)).toBe(false);
			expect(LEGACY_CONDITIONS.organizationId(payload)).toBe(false);
		}

		// And `sentTo` on its own switched off the membership check of a foreign organizationId.
		expect(LEGACY_CONDITIONS.organizationId({ sentTo: 'contact-1', organizationId: FOREIGN_ORGANIZATION_ID })).toBe(
			false
		);
	});
});
