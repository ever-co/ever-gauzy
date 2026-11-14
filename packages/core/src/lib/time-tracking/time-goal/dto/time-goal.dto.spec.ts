import '../../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate, ValidationError, ValidatorOptions } from 'class-validator';
import { TimeGoalComparisonEnum, TimeGoalPeriodEnum, TimeGoalScopeEnum } from '@gauzy/contracts';
import { CreateTimeGoalDTO } from './create-time-goal.dto';
import { TimeGoalProgressQueryDTO } from './time-goal-progress-query.dto';
import { TimeGoalQueryDTO } from './time-goal-query.dto';
import { UpdateTimeGoalDTO } from './update-time-goal.dto';

const PROJECT = '00000000-0000-4000-8000-000000000001';
const EMPLOYEE = '00000000-0000-4000-8000-000000000002';

/**
 * `sentTo` switches off the organization membership check of the base DTO, which needs a database: the checks of the
 * time goal fields are what is under test here.
 */
const BASE = { sentTo: 'unit-test' };

const VALID_GOAL = {
	...BASE,
	name: 'Client A, at least 20 h a week',
	comparison: TimeGoalComparisonEnum.AT_LEAST,
	targetHours: 20,
	period: TimeGoalPeriodEnum.WEEK,
	scope: TimeGoalScopeEnum.EMPLOYEE
};

async function check<T extends object>(
	type: new () => T,
	payload: Record<string, unknown>,
	options?: ValidatorOptions
): Promise<{ dto: T; errors: ValidationError[] }> {
	const dto = plainToInstance(type, payload);
	return { dto, errors: await validate(dto, options) };
}

const fields = (errors: ValidationError[]) => errors.map(({ property }) => property).sort();

describe('time goal DTOs', () => {
	describe('CreateTimeGoalDTO', () => {
		it('accepts a goal, and reads a single project id sent in a query string as a list', async () => {
			const { dto, errors } = await check(CreateTimeGoalDTO, {
				...VALID_GOAL,
				targetHours: 7.75,
				projectIds: PROJECT,
				employeeId: EMPLOYEE,
				billableOnly: true
			});

			expect(errors).toEqual([]);
			expect(dto.projectIds).toEqual([PROJECT]);
		});

		it.each([
			['comparison', 'MORE'],
			['period', 'YEAR'],
			['scope', 'GROUP'],
			['targetHours', 0],
			['targetHours', 2.555],
			['targetHours', 745],
			['targetHours', '20'],
			['name', ''],
			['name', 'x'.repeat(256)],
			['employeeId', 'not-an-id'],
			['projectIds', ['not-an-id']],
			['organizationContactIds', 'not-an-id'],
			['billableOnly', 'yes']
		])('refuses %s %p', async (property, value) => {
			const { errors } = await check(CreateTimeGoalDTO, { ...VALID_GOAL, [property]: value });

			expect(fields(errors)).toEqual([property]);
		});

		it('refuses a goal without its name, comparison, target, period or scope', async () => {
			const { errors } = await check(CreateTimeGoalDTO, BASE);

			expect(fields(errors)).toEqual(['comparison', 'name', 'period', 'scope', 'targetHours']);
		});
	});

	describe('UpdateTimeGoalDTO', () => {
		it('accepts a change of one field', async () => {
			const { errors } = await check(UpdateTimeGoalDTO, { ...BASE, targetHours: 30 });

			expect(errors).toEqual([]);
		});

		it.each([['name'], ['comparison'], ['targetHours'], ['period']])(
			'refuses %s sent as null',
			async (property) => {
				const { errors } = await check(UpdateTimeGoalDTO, { ...BASE, [property]: null });

				expect(fields(errors)).toEqual([property]);
			}
		);

		it('does not declare who a goal counts, so a whitelisting pipe drops it', async () => {
			const { errors } = await check(
				UpdateTimeGoalDTO,
				{ ...BASE, scope: TimeGoalScopeEnum.ORGANIZATION, employeeId: EMPLOYEE, organizationTeamId: PROJECT },
				{ whitelist: true, forbidNonWhitelisted: true }
			);

			expect(fields(errors)).toEqual(['employeeId', 'organizationTeamId', 'scope']);
		});
	});

	describe('TimeGoalQueryDTO', () => {
		it.each([
			[undefined, false],
			['true', true],
			['false', false]
		])('reads includeArchived %p as %p', async (value, expected) => {
			const { dto, errors } = await check(TimeGoalQueryDTO, { ...BASE, includeArchived: value });

			expect(errors).toEqual([]);
			expect(dto.includeArchived).toBe(expected);
		});
	});

	describe('TimeGoalProgressQueryDTO', () => {
		it('accepts a local date and member ids, a single one included', async () => {
			const { dto, errors } = await check(TimeGoalProgressQueryDTO, {
				...BASE,
				date: '2026-11-11',
				employeeIds: EMPLOYEE
			});

			expect(errors).toEqual([]);
			expect(dto.employeeIds).toEqual([EMPLOYEE]);
		});

		it.each([['2026-02-30'], ['2026-11-11T00:00:00.000Z'], ['11/11/2026'], ['2026-1-01']])(
			'refuses the date %p',
			async (date) => {
				const { errors } = await check(TimeGoalProgressQueryDTO, { ...BASE, date });

				expect(fields(errors)).toEqual(['date']);
			}
		);

		it('refuses ids that are not ids', async () => {
			const { errors } = await check(TimeGoalProgressQueryDTO, {
				...BASE,
				goalIds: ['x'],
				organizationTeamId: 'y'
			});

			expect(fields(errors)).toEqual(['goalIds', 'organizationTeamId']);
		});
	});
});
