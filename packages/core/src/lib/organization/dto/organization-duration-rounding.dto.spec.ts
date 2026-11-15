/**
 * 🛑 This import must stay FIRST: the organization DTOs pick from the entity, which reaches the decorator graph.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DURATION_ROUNDING_INTERVALS } from '@gauzy/constants';
import { CurrenciesEnum, DurationRoundingDirectionEnum } from '@gauzy/contracts';
import { CreateOrganizationDTO } from './create-organization.dto';
import { UpdateOrganizationDTO } from './update-organization.dto';

/**
 * Issue ever-co/ever-gauzy#11915: an organization's duration rounding rule is an interval of 1, 5, 6, 10, 15, 30 or 60
 * minutes with a direction, or nothing. The create and the update validate it like the other organization settings:
 * a write that sends neither value is checked as before.
 */
describe.each([
	['CreateOrganizationDTO', CreateOrganizationDTO],
	['UpdateOrganizationDTO', UpdateOrganizationDTO]
])('%s duration rounding rule', (_name, dto) => {
	const invalidPropertiesOf = async (rule: Record<string, unknown>) => {
		const errors = await validate(plainToInstance(dto, { name: 'Acme', currency: CurrenciesEnum.EUR, ...rule }));
		return errors.map((error) => error.property);
	};

	it('accepts a write that sends no rule, as every client did before', async () => {
		expect(await invalidPropertiesOf({})).toEqual([]);
	});

	it('accepts every allowed interval with every direction', async () => {
		for (const durationRoundingInterval of DURATION_ROUNDING_INTERVALS) {
			for (const durationRoundingDirection of Object.values(DurationRoundingDirectionEnum)) {
				expect(await invalidPropertiesOf({ durationRoundingInterval, durationRoundingDirection })).toEqual([]);
			}
		}
	});

	it('accepts both values null, which turns the rule off', async () => {
		expect(await invalidPropertiesOf({ durationRoundingInterval: null, durationRoundingDirection: null })).toEqual(
			[]
		);
	});

	it('refuses an interval the rule does not offer', async () => {
		for (const durationRoundingInterval of [7, 0, -15, 15.5, 120, '15']) {
			expect(await invalidPropertiesOf({ durationRoundingInterval, durationRoundingDirection: 'UP' })).toEqual([
				'durationRoundingInterval'
			]);
		}
	});

	it('refuses an unknown direction', async () => {
		for (const durationRoundingDirection of ['SIDEWAYS', 'up', '']) {
			expect(await invalidPropertiesOf({ durationRoundingInterval: 15, durationRoundingDirection })).toEqual([
				'durationRoundingDirection'
			]);
		}
	});

	it('refuses an interval without a direction, and a direction without an interval', async () => {
		expect(await invalidPropertiesOf({ durationRoundingInterval: 15 })).toEqual(['durationRoundingDirection']);
		expect(await invalidPropertiesOf({ durationRoundingInterval: 15, durationRoundingDirection: null })).toEqual([
			'durationRoundingDirection'
		]);
		expect(await invalidPropertiesOf({ durationRoundingDirection: 'NEAREST' })).toEqual([
			'durationRoundingInterval'
		]);
	});

	it('refuses one value cleared alone, which would leave half a rule stored', async () => {
		expect(await invalidPropertiesOf({ durationRoundingInterval: null })).toEqual([
			'durationRoundingInterval',
			'durationRoundingDirection'
		]);
		expect(await invalidPropertiesOf({ durationRoundingDirection: null })).toEqual([
			'durationRoundingInterval',
			'durationRoundingDirection'
		]);
	});
});
