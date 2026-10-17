// The controller alone: its decorators' packages and the pipeline (which needs a database) are doubled.
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));
jest.mock('./inbox-inbound.service', () => ({ InboxInboundService: class {} }));

import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { InboxInboundController } from './inbox-inbound.controller';

describe('InboxInboundController', () => {
	it('serves the account URL, and the same URL ending in /mime (Mailgun raw-message routes)', () => {
		expect(Reflect.getMetadata(PATH_METADATA, InboxInboundController.prototype.receive)).toEqual([
			'/:providerId/:accountId',
			'/:providerId/:accountId/mime'
		]);
	});

	it('hands the request over with lower-cased headers, the raw bytes and the URL as received', async () => {
		const receive = jest.fn(async () => ({ accepted: 1, duplicates: 0, dropped: 0 }));
		const controller = new InboxInboundController({ receive } as never);
		await controller.receive('mailgun', 'a1', {
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: { token: 't' },
			rawBody: Buffer.from('token=t'),
			query: {},
			originalUrl: '/api/inbox/inbound/mailgun/a1/mime'
		});
		expect(receive).toHaveBeenCalledWith('mailgun', 'a1', {
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: { token: 't' },
			rawBody: Buffer.from('token=t'),
			query: {},
			url: '/api/inbox/inbound/mailgun/a1/mime'
		});
	});
});
