import { HttpException, HttpStatus } from '@nestjs/common';
import { UpworkAuthorizationController } from './upwork-authorization.controller';

/**
 * The callback validated its query and threw a 400, but the surrounding `catch` re-wrapped every error as a 500,
 * so a request with a missing `oauth_token` or `oauth_verifier` was reported as a server failure.
 */
describe('UpworkAuthorizationController.upworkIntegrationCallback', () => {
	const setup = (postInstallUrl = 'https://app.example.test/post-install') => {
		const config = { get: jest.fn().mockReturnValue({ postInstallUrl }) };
		const response = { redirect: jest.fn() };
		const controller = new UpworkAuthorizationController(config as never);
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
		['no oauth_token', { oauth_verifier: 'v' }],
		['no oauth_verifier', { oauth_token: 't' }],
		['an empty query', {}],
		['no query at all', undefined]
	])('answers 400 when the query has %s', async (_label, query) => {
		const { controller, response } = setup();

		const status = await statusOf(controller.upworkIntegrationCallback(query, response as never));

		expect(status).toBe(HttpStatus.BAD_REQUEST);
		expect(response.redirect).not.toHaveBeenCalled();
	});

	it('still redirects to the post-install URL with the token and verifier', async () => {
		const { controller, response } = setup();

		await controller.upworkIntegrationCallback({ oauth_token: 'a b', oauth_verifier: 'xyz' }, response as never);

		expect(response.redirect).toHaveBeenCalledWith(
			'https://app.example.test/post-install?oauth_token=a%20b&oauth_verifier=xyz'
		);
	});

	it('still answers 500 for an unexpected failure', async () => {
		const { controller } = setup();
		const response = {
			redirect: jest.fn(() => {
				throw new Error('boom');
			})
		};

		const query = { oauth_token: 't', oauth_verifier: 'v' };
		const status = await statusOf(controller.upworkIntegrationCallback(query, response as never));

		expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
	});
});
