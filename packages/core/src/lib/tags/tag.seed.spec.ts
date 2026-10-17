import '../core/entities/internal';

import { DEFAULT_ORGANIZATION_TAGS } from './default-tags';
import { createRandomOrganizationTags } from './tag.seed';

/**
 * `createRandomOrganizationTags` declared a second `tags` inside its loop (the default tag names), which shadowed
 * the list it collects: `tags.push(...)` grew the DEFAULT_ORGANIZATION_TAGS constant itself, and the function saved
 * an empty list — random organizations got no tags from it, only the ones the task seed makes from issue labels.
 */
describe('createRandomOrganizationTags', () => {
	it('saves the default tags for every organization and leaves the defaults untouched', async () => {
		const defaults = [...DEFAULT_ORGANIZATION_TAGS];
		const tenant = { id: 'tenant-1' };
		const organizations = [{ id: 'org-1' }, { id: 'org-2' }];
		const save = jest.fn(async (rows: unknown) => rows);

		const saved = await createRandomOrganizationTags(
			{ manager: { save } } as never,
			[tenant] as never,
			new Map([[tenant, organizations]]) as never,
			[{ id: 'tag-type-1' }] as never
		);

		expect(saved).toHaveLength(organizations.length * defaults.length);
		expect(saved.map((tag) => tag.name)).toEqual([...defaults, ...defaults]);
		expect(saved.filter((tag) => tag.organization === (organizations[1] as never))).toHaveLength(defaults.length);
		expect(DEFAULT_ORGANIZATION_TAGS).toEqual(defaults);
	});
});
