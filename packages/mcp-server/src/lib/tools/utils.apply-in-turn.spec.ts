/**
 * A bulk tool that applies its items one by one stops at the first refusal and says how many were applied. It kept only
 * the HTTP client's message, so the assistant lost the API's reason for the refusal (#12104). The reason now follows
 * the count.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { applyInTurn } from './utils';

const REASON = 'name should not be empty';

/** The API client's refusal, with the API's reason in its answer. */
const refusal = () =>
	Object.assign(new Error('Request failed with status code 400'), {
		response: { status: 400, data: { statusCode: 400, message: [REASON] } }
	});

describe('applyInTurn: a refusal partway through', () => {
	it("keeps the count of applied items and the API's reason", async () => {
		const apply = jest.fn().mockResolvedValueOnce({ id: 'first' }).mockRejectedValueOnce(refusal());

		await expect(applyInTurn(['first', 'second'], apply)).rejects.toThrow(
			`Item 2 of 2 failed after 1 applied: Request failed with status code 400: ${REASON}`
		);
	});

	it('CONTROL: keeps the message of a failure that carries no reason', async () => {
		const apply = jest.fn().mockRejectedValueOnce(new Error('Request failed with status code 404'));

		await expect(applyInTurn(['first'], apply)).rejects.toThrow(
			'Item 1 of 1 failed after 0 applied: Request failed with status code 404'
		);
	});
});
