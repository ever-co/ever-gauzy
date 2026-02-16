import { RESERVED_PAGE_SECTION_PATHS } from '@gauzy/ui-core/core';
import { getPagesRoutes } from './pages.routes';

/**
 * Asserts that RESERVED_PAGE_SECTION_PATHS stays in sync with the core route
 * paths from getPagesRoutes(). Prevents adding new core routes without updating
 * the reserved set (which would allow plugins to register conflicting paths).
 */
describe('pages.routes', () => {
	it('RESERVED_PAGE_SECTION_PATHS matches core top-level paths from getPagesRoutes()', () => {
		const mockRegistry = {
			getPageLocationRoutes: () => []
		} as any;
		const routes = getPagesRoutes(mockRegistry);
		const parent = routes[0];
		const children = parent?.children ?? [];
		const corePaths = new Set<string>(
			children.map((r) => r.path).filter((p): p is string => typeof p === 'string' && p !== '' && p !== '**')
		);
		const reserved = RESERVED_PAGE_SECTION_PATHS;

		const missing = [...reserved].filter((p) => !corePaths.has(p));
		const extra = [...corePaths].filter((p) => !reserved.has(p));

		expect(missing).toEqual([]);
		expect(extra).toEqual([]);
	});
});
