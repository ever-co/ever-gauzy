import { HttpException, HttpStatus } from '@nestjs/common';
import { HubstaffAuthorizationController } from './hubstaff-authorization.controller';

/**
 * The callback validated its query and threw a 400, but the surrounding `catch` re-wrapped every error as a 500,
 * so a request with a missing `code` or `state` was reported as a server failure.
 */
describe('HubstaffAuthorizationController.hubstaffIntegrationCallback', () => {
	const setup = (postInstallUrl = 'https://app.example.test/post-install') => {
		const config = { get: jest.fn().mockReturnValue({ postInstallUrl }) };
		const response = { redirect: jest.fn() };
		const controller = new HubstaffAuthorizationController(config as never);
		return { controller, response };
	};

	const statusOf = async (promise: Promise<unknown>): Promise<number | undefined> => {
		try {
			await promise;
		} catch (error) {
			return (error as HttpException).getStatus();
		}
		return undefined;
	};

	it.each([
		['no code', { state: 's' }],
		['no state', { code: 'c' }],
		['an empty query', {}]
	])('answers 400 when the query has %s', async (_label, query) => {
		const { controller, response } = setup();

		const status = await statusOf(controller.hubstaffIntegrationCallback(query, response as never));

		expect(status).toBe(HttpStatus.BAD_REQUEST);
		expect(response.redirect).not.toHaveBeenCalled();
	});

	it('still redirects to the post-install URL with the code and state', async () => {
		const { controller, response } = setup();

		await controller.hubstaffIntegrationCallback({ code: 'a b', state: 'xyz' }, response as never);

		expect(response.redirect).toHaveBeenCalledWith('https://app.example.test/post-install?code=a%20b&state=xyz');
	});

	it('still answers 500 for an unexpected failure', async () => {
		const { controller } = setup();
		const response = {
			redirect: jest.fn(() => {
				throw new Error('boom');
			})
		};

		const query = { code: 'c', state: 's' };
		const status = await statusOf(controller.hubstaffIntegrationCallback(query, response as never));

		expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
	});
});
