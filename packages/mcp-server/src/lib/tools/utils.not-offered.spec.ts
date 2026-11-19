/**
 * The answer of a tool whose action the Gauzy API has no route for: it says so plainly, and names the tool that does a
 * close action when there is one.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { notOfferedByApi } from './utils';

describe('notOfferedByApi', () => {
	it('says the server does not offer the action', () => {
		expect(notOfferedByApi('deal statistics').message).toBe(
			'This server does not offer deal statistics: the Gauzy API has no route for that.'
		);
	});

	it('names the tool that does a close action', () => {
		expect(notOfferedByApi('rating a candidate', 'Candidates are rated through interview feedback.').message).toBe(
			'This server does not offer rating a candidate: the Gauzy API has no route for that. ' +
				'Candidates are rated through interview feedback.'
		);
	});
});
