import { ActorTypeEnum } from '@gauzy/contracts';
import { ActorTypeTransformer } from './actor-type-transform';

/**
 * The actor type is stored as an integer. `System` (0) and `User` (1) keep the values every existing
 * row was written with; `Agent` (2) is the agent employee added for the Ever Works integration.
 */
describe('ActorTypeTransformer', () => {
	const transformer = new ActorTypeTransformer();

	it.each([
		[ActorTypeEnum.System, 0],
		[ActorTypeEnum.User, 1],
		[ActorTypeEnum.Agent, 2]
	])('stores %s as %i and reads it back', (actorType, stored) => {
		expect(transformer.to(actorType)).toBe(stored);
		expect(transformer.from(stored)).toBe(actorType);
	});

	it('stores a missing or unknown value as System (0), as before', () => {
		expect(transformer.to(undefined as unknown as ActorTypeEnum)).toBe(0);
		expect(transformer.to(null as unknown as ActorTypeEnum)).toBe(0);
		expect(transformer.to('constructor' as unknown as ActorTypeEnum)).toBe(0);
	});

	it('reads a missing or unknown integer as System, as before', () => {
		expect(transformer.from(null as unknown as number)).toBe(ActorTypeEnum.System);
		expect(transformer.from(undefined as unknown as number)).toBe(ActorTypeEnum.System);
		expect(transformer.from(7)).toBe(ActorTypeEnum.System);
	});

	it('maps every ActorTypeEnum member to a distinct integer', () => {
		const stored = Object.values(ActorTypeEnum).map((actorType) => transformer.to(actorType));
		expect(new Set(stored).size).toBe(Object.values(ActorTypeEnum).length);
	});
});
