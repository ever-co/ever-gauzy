import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readEverConnectConfig } from '../ever-connect-config';
import { EverConnectInstanceController } from '../ever-connect-instance.controller';
import { EverConnectOperatorGuard } from '../guards/ever-connect-operator.guard';

/**
 * `GET /api/ever-connect/probe`: what the web app's menu needs to show the Ever Platform entry. Behind the
 * operator check of the installation's routes (404 to everyone else, and no route at all where the
 * module is not loaded); no request to Ever Platform, no id, name or address in the answer.
 */
describe('the menu probe', () => {
	const controller = (status: string, env: Record<string, string> = {}) => {
		const connection = { connection: jest.fn(async () => ({ status, platformInstanceId: 'not-in-the-answer' })) };
		return {
			connection,
			instance: new EverConnectInstanceController(
				connection as never,
				{} as never,
				{} as never,
				{} as never,
				readEverConnectConfig(env)
			)
		};
	};

	it('is a GET of the operator routes', () => {
		const handler = EverConnectInstanceController.prototype.probe;
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('probe');
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
		expect(Reflect.getMetadata(GUARDS_METADATA, EverConnectInstanceController)).toContain(EverConnectOperatorGuard);
	});

	it('answers whether the module is loaded and the connection state, nothing else', async () => {
		const { instance } = controller('connected');
		const answer = await instance.probe();
		expect(answer).toEqual({ loaded: true, managed_by: 'operator', status: 'connected', connected: true });
		expect(JSON.stringify(answer)).not.toContain('not-in-the-answer');
		expect(await controller('pending_approval', { EVER_INSTALL_SOURCE: 'cloud' }).instance.probe()).toEqual({
			loaded: true,
			managed_by: 'ever_cloud',
			status: 'pending_approval',
			connected: false
		});
	});
});
