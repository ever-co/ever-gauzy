import { createRandomProposals } from './proposal.seed';

/**
 * The random proposal seed picked a tag with `faker.helpers.arrayElement(tags)`, which throws "Cannot get value from
 * empty dataset" on an organization without tags — the task seed creates the tags from issue labels, so with no
 * issues the whole plugin's random seed failed. An organization without employees threw the same way.
 */
describe('createRandomProposals', () => {
	const tenant = { id: 'tenant-1' };
	const organization = { id: 'org-1' };
	const otherOrganization = { id: 'org-2' };

	const connection = () => ({
		manager: {
			// No tag and no contact in either organization
			findBy: jest.fn(async () => []),
			save: jest.fn(async (rows: unknown) => rows)
		}
	});

	it('seeds proposals without a tag for an organization that has none, and skips one without employees', async () => {
		const proposals = await createRandomProposals(
			connection() as never,
			[tenant] as never,
			new Map([[tenant, [organization, otherOrganization]]]) as never,
			new Map([
				[organization, [{ id: 'employee-1' }]],
				[otherOrganization, []]
			]) as never,
			2
		);

		expect(proposals).toHaveLength(2);
		expect(proposals.every((proposal) => proposal.organization === (organization as never))).toBe(true);
		expect(proposals.every((proposal) => Array.isArray(proposal.tags) && proposal.tags.length === 0)).toBe(true);
	});
});
