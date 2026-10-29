import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { PlaceholderImageController } from './placeholder-image.controller';

/**
 * The route that draws placeholder images in place of the third-party dummyimage.com (Ever Gauzy #618). It is called
 * by every `<img>` and React Native `Image` showing a record without an image of its own, so it is public, answers a
 * PNG, may be embedded by any site and is cached by clients.
 */
describe('PlaceholderImageController', () => {
	// The first image reads the font, and sharp starts its thread pool (seconds on a cold Windows runner).
	jest.setTimeout(60_000);

	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ controllers: [PlaceholderImageController] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix('api');
		await app.init();
	});

	afterAll(() => app?.close());

	it('is public', () => {
		const reflector = new Reflector();
		expect(reflector.get(PUBLIC_METHOD_METADATA, PlaceholderImageController.prototype.getPlaceholderImage)).toBe(
			true
		);
	});

	it('answers a PNG any site may embed, cached for a year', async () => {
		const response = await request(app.getHttpServer())
			.get('/api/placeholder/330x300/269aff?text=A')
			.buffer(true)
			.parse((res, callback) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () => callback(null, Buffer.concat(chunks)));
			})
			.expect(200);

		expect(response.headers['content-type']).toBe('image/png');
		expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
		expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
		// The PNG signature.
		expect((response.body as Buffer).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		expect(Number(response.headers['content-length'])).toBe((response.body as Buffer).length);
	});

	it('draws a placeholder without text', async () => {
		await request(app.getHttpServer())
			.get('/api/placeholder/330x300/8b72ff')
			.expect(200)
			.expect('content-type', 'image/png');
	});

	it('refuses a size or a background it cannot draw with 400, and caches nothing', async () => {
		for (const path of [
			'/api/placeholder/5000x5000/269aff',
			'/api/placeholder/330x300/nope',
			'/api/placeholder/big/269aff'
		]) {
			const response = await request(app.getHttpServer()).get(path).expect(400);
			expect(response.headers['cache-control']).not.toBe('public, max-age=31536000, immutable');
		}
	});
});
