import { NotFoundException, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Request } from 'express';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { IEmbedClientReport } from '@gauzy/contracts';
import { EmbedCredentialService } from './embed-credential.service';
import { EmbedTokenController } from './embed.controller';
import { EmbedEnabledGuard } from './embed.guards';
import { EMBED_TOKENS_ENV } from './embed.utils';

/**
 * `POST /api/embed/client-report`, as the controller declares it: public (the credential is the proof), behind the
 * switch that answers 404 while embeds are off, answered 200, and handed to the service with the client address the
 * rate limiter resolves. Its rate limit is the exchange's (`embed-exchange-throttle.spec.ts`).
 */

const handler = EmbedTokenController.prototype.clientReport;

let savedSwitch: string | undefined;
beforeAll(() => {
	savedSwitch = process.env[EMBED_TOKENS_ENV];
});
afterEach(() => {
	delete process.env[EMBED_TOKENS_ENV];
});
afterAll(() => {
	if (savedSwitch !== undefined) {
		process.env[EMBED_TOKENS_ENV] = savedSwitch;
	}
});

describe('POST /embed/client-report', () => {
	it('is a public POST under /embed, answered 200', () => {
		expect(Reflect.getMetadata(PATH_METADATA, EmbedTokenController)).toBe('/embed');
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/client-report');
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handler)).toBe(true);
	});

	it('answers 404 while embeds are off, through the switch the other embed routes have', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([EmbedEnabledGuard]);

		expect(() => new EmbedEnabledGuard().canActivate()).toThrow(NotFoundException);
		process.env[EMBED_TOKENS_ENV] = 'true';
		expect(new EmbedEnabledGuard().canActivate()).toBe(true);
	});

	it('hands the body and the client address to the service, and answers its report', async () => {
		const report = { client: { id: 'c', name: 'Northwind' } } as IEmbedClientReport;
		const clientReport = jest.fn(async () => report);
		const controller = new EmbedTokenController({ clientReport } as unknown as EmbedCredentialService);
		const body = { credential: 'gze_a-credential' };
		const request = { ip: '203.0.113.7', headers: {}, body } as unknown as Request;

		await expect(controller.clientReport(body, request)).resolves.toBe(report);

		expect(clientReport).toHaveBeenCalledWith(body, '203.0.113.7');
	});
});
