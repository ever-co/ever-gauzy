/**
 * `@gauzy/plugin-docs` is a full Nest module graph (entities, BullMQ host, extraction providers);
 * this file only needs the class identity, so a stub stands in for it.
 */
jest.mock('@gauzy/plugin-docs', () => ({ DocsPlugin: class DocsPlugin {} }));

import { DocsPlugin } from '@gauzy/plugin-docs';
import { plugins } from './plugins';

describe('worker plugins', () => {
	it('registers the Documents plugin so the docs-processing queue is drained here', () => {
		expect(plugins).toContain(DocsPlugin);
	});
});
