// The registry's domain and shared barrels drag in the entity graph; the handler only calls the service.
jest.mock('../../../../domain', () => ({ PluginCategoryService: class PluginCategoryService {} }));
jest.mock('../../../../shared', () => ({}));

import { BadRequestException } from '@nestjs/common';
import { GetPluginCategoryQuery } from '../get-plugin-category.query';
import { GetPluginCategoryHandler, PLUGIN_CATEGORY_READABLE_RELATIONS } from './get-plugin-category-query.handler';

const CATEGORY = '44444444-4444-4444-8444-444444444444';

function handler() {
	const service = { findOneByIdString: jest.fn(async (id: string, _options: unknown) => ({ id })) };
	return { instance: new GetPluginCategoryHandler(service as any), service };
}

describe('GetPluginCategoryHandler relations', () => {
	it('loads the tree and the plugins when the caller names no relation', async () => {
		const { instance, service } = handler();

		await instance.execute(new GetPluginCategoryQuery(CATEGORY));

		expect(service.findOneByIdString).toHaveBeenCalledWith(CATEGORY, {
			relations: ['parent', 'children', 'plugins']
		});
	});

	it('accepts any of the readable relations, as an array or as the single string a lone query parameter is', async () => {
		const { instance, service } = handler();

		await instance.execute(new GetPluginCategoryQuery(CATEGORY, ['children', 'plugins']));
		await instance.execute(new GetPluginCategoryQuery(CATEGORY, 'parent' as unknown as string[]));

		expect(service.findOneByIdString.mock.calls.map(([, options]) => options)).toEqual([
			{ relations: ['children', 'plugins'] },
			{ relations: ['parent'] }
		]);
	});

	it.each([
		['the setting values', ['settings']],
		['the tenant row', ['tenant']],
		['the organization row', ['organization']],
		['a nested path through a readable relation', ['plugins.versions']],
		['an unreadable relation beside readable ones', ['children', 'settings']],
		['an unreadable relation as a lone string', 'settings' as unknown as string[]]
	])('refuses %s, and reads nothing', async (_label, relations) => {
		const { instance, service } = handler();

		await expect(instance.execute(new GetPluginCategoryQuery(CATEGORY, relations))).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(service.findOneByIdString).not.toHaveBeenCalled();
	});

	it('keeps the readable list to the category’s tree and its plugins', () => {
		expect([...PLUGIN_CATEGORY_READABLE_RELATIONS].sort()).toEqual(['children', 'parent', 'plugins']);
	});
});
