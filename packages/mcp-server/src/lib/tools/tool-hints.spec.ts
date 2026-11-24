import { ToolAnnotationsSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_HINTS } from './tool-hints';

describe('TOOL_HINTS', () => {
	it('are hints of the MCP specification, frozen so no tool changes those of another', () => {
		for (const hints of Object.values(TOOL_HINTS)) {
			expect(ToolAnnotationsSchema.strict().parse(hints)).toEqual(hints);
			expect(Object.isFrozen(hints)).toBe(true);
		}
		expect(Object.isFrozen(TOOL_HINTS)).toBe(true);
	});

	it('mark a write destructive only where it replaces or removes, and open world only where it sends out', () => {
		const destructive = Object.entries(TOOL_HINTS).filter(([, hints]) => hints.destructiveHint === true);
		const openWorld = Object.entries(TOOL_HINTS).filter(([, hints]) => hints.openWorldHint === true);

		expect(destructive.map(([name]) => name)).toEqual([
			'destructive',
			'idempotentDestructive',
			'openWorldDestructive'
		]);
		expect(openWorld.map(([name]) => name)).toEqual(['openWorldDestructive']);
		expect(TOOL_HINTS.readOnly.readOnlyHint).toBe(true);
	});
});
