/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { DealController } from './deal.controller';
import { UpdateDealDTO } from './dto';

/**
 * `PUT /deals/:id` takes a partial body (moving a deal on the board sends only `stageId`), but every
 * deal member that IS sent has to meet the rules the create route applies, and every member the DTO
 * does not declare has to reach the service untouched.
 */

const STAGE = '00000000-0000-4000-8000-000000000020';
const CLIENT = '00000000-0000-4000-8000-000000000030';

/** The pipe the route runs, as the decorator attached it to the handler. */
function routePipe(): ValidationPipe {
	const pipes = Reflect.getMetadata(PIPES_METADATA, DealController.prototype.update) as ValidationPipe[];
	expect(pipes).toHaveLength(1);
	expect(pipes[0]).toBeInstanceOf(ValidationPipe);
	return pipes[0];
}

/** Runs the body through the route's pipe the way the framework does for the `@Body()` argument. */
function validateBody(body: unknown): Promise<unknown> {
	return routePipe().transform(body, { type: 'body', metatype: UpdateDealDTO });
}

describe('PUT /deals/:id body validation', () => {
	it('types the body parameter with the DTO class, so the pipe has a class to validate', () => {
		const types = Reflect.getMetadata('design:paramtypes', DealController.prototype, 'update') as unknown[];
		expect(types[1]).toBe(UpdateDealDTO);
	});

	it.each([
		['a stage-only move', { stageId: STAGE }],
		['a title-only edit', { title: 'Renewal' }],
		['the lowest probability', { probability: 0 }],
		['the highest probability', { probability: 5 }],
		['a client removed', { clientId: null }],
		['an empty body', {}]
	])('accepts %s', async (_name, body) => {
		await expect(validateBody(body)).resolves.toEqual(body);
	});

	it('keeps scope and other members the DTO does not declare, exactly as sent', async () => {
		const body = {
			stageId: STAGE,
			clientId: CLIENT,
			organizationId: '00000000-0000-4000-8000-000000000002',
			tenantId: '00000000-0000-4000-8000-000000000001',
			isArchived: true
		};
		await expect(validateBody(body)).resolves.toEqual(body);
	});

	it.each([
		['a probability above the range', { probability: 99 }],
		['a negative probability', { probability: -1 }],
		['a fractional probability', { probability: 2.5 }],
		['a non-numeric probability', { probability: 'high' }],
		['an empty title', { title: '' }],
		['a non-string title', { title: { a: 1 } }],
		['a stage that is not a UUID', { stageId: 'not-a-uuid' }],
		['a client that is not a UUID', { clientId: 'not-a-uuid' }]
	])('refuses %s with a 400', async (_name, body) => {
		await expect(validateBody(body)).rejects.toBeInstanceOf(BadRequestException);
	});
});
