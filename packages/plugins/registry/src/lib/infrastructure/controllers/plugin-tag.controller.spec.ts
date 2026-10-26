import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nest registers a controller's routes in the order its handlers are declared, so a literal segment declared
 * after a parameterised one on the same method never matches: `DELETE /plugin-tags/batch` used to be answered by
 * `DELETE :id`, whose `UUIDValidationPipe` refused "batch". Read from the source rather than by importing the
 * controller, which drags in the entity graph.
 */
describe('PluginTagController route order', () => {
	const source = readFileSync(join(__dirname, 'plugin-tag.controller.ts'), 'utf8');

	it.each(['Delete', 'Post', 'Put', 'Get'])('declares every literal %s route before the :id one', (method) => {
		const parameterised = source.indexOf(`@${method}(':id')`);
		const literals = [...source.matchAll(new RegExp(`@${method}\\('([a-z][\\w-]*)'\\)`, 'g'))];

		for (const literal of literals) {
			if (parameterised !== -1) {
				expect({ route: literal[1], beforeId: (literal.index ?? 0) < parameterised }).toEqual({
					route: literal[1],
					beforeId: true
				});
			}
		}
	});

	it('still serves the batch delete', () => {
		expect(source).toContain("@Delete('batch')");
	});
});
