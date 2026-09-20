/**
 * Importing `Candidate` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order and avoids the decorator import cycle other
 * entity specs hit.
 */
import '../core/entities/internal';

import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Candidate } from './candidate.entity';
import { UpdateCandidateDTO } from './dto/update-candidate.dto';

/**
 * The Candidate `@Transform`s shape every API response (the global TransformInterceptor runs
 * `instanceToPlain`) and any `plainToInstance(Candidate, …)`. `parseInt` used to drop cents so `10.49`
 * became `10` (#10199), and hiring the candidate copied the truncated rate into the new employee.
 * Weekly limit stays hours (integer). The PUT request path is covered by the `UpdateCandidateDTO`
 * block below.
 */
describe('Candidate billing rate transforms', () => {
	it('keeps two decimal places on billRateValue and minimumBillingRate', () => {
		const candidate = plainToInstance(Candidate, {
			billRateValue: '10.49',
			minimumBillingRate: 12.5
		});

		expect(candidate.billRateValue).toBe(10.49);
		expect(candidate.minimumBillingRate).toBe(12.5);
	});

	it('rounds monetary rates to two decimal places', () => {
		const candidate = plainToInstance(Candidate, { billRateValue: 10.499 });

		expect(candidate.billRateValue).toBe(10.5);
	});

	it('rounds half-cents up instead of using binary toFixed', () => {
		const candidate = plainToInstance(Candidate, { billRateValue: 1.005 });

		expect(candidate.billRateValue).toBe(1.01);
	});

	it('leaves non-numeric rates as NaN so @IsNumber rejects them, and keeps leading-number parsing', () => {
		const candidate = plainToInstance(Candidate, { billRateValue: 'abc', minimumBillingRate: '10,50' });

		expect(candidate.billRateValue).toBeNaN();
		expect(candidate.minimumBillingRate).toBe(10);
	});

	it('turns empty rates into 0, as before', () => {
		const candidate = plainToInstance(Candidate, { billRateValue: '', minimumBillingRate: null });

		expect(candidate.billRateValue).toBe(0);
		expect(candidate.minimumBillingRate).toBe(0);
	});

	it('keeps rates up to the old integer ceiling', () => {
		const candidate = plainToInstance(Candidate, { billRateValue: 2147483647 });

		expect(candidate.billRateValue).toBe(2147483647);
	});

	it('still parses reWeeklyLimit as whole hours', () => {
		const candidate = plainToInstance(Candidate, { reWeeklyLimit: '37.9' });

		expect(candidate.reWeeklyLimit).toBe(37);
	});

	it('keeps cents in API responses (the global TransformInterceptor runs instanceToPlain)', () => {
		const candidate = Object.assign(new Candidate(), { billRateValue: 10.49, minimumBillingRate: null });

		const plain = instanceToPlain(candidate);

		expect(plain.billRateValue).toBe(10.49);
		expect(plain.minimumBillingRate).toBe(0);
	});
});

/**
 * `PUT /candidate/:id` validates `UpdateCandidateDTO`, which takes the rate fields from the employee
 * `UpdateProfileDTO`. That is the path the rates form uses; the candidate column must accept what it
 * lets through.
 */
describe('UpdateCandidateDTO billing rates', () => {
	/** The DTO also requires organization fields; only the rate fields matter here. */
	const rateErrors = async (dto: UpdateCandidateDTO) =>
		(await validate(dto))
			.map((error) => error.property)
			.filter((property) => ['billRateValue', 'minimumBillingRate'].includes(property));

	it('keeps cents through UpdateProfileDTO (what the candidate columns must now hold)', async () => {
		const dto = plainToInstance(UpdateCandidateDTO, { billRateValue: '10.49', minimumBillingRate: 1.005 });

		expect(dto.billRateValue).toBe(10.49);
		expect(dto.minimumBillingRate).toBe(1.01);
		expect(await rateErrors(dto)).toEqual([]);
	});

	it('rejects a rate the numeric(14,2) column cannot hold, instead of failing in the database', async () => {
		const tooBig = plainToInstance(UpdateCandidateDTO, { billRateValue: 1e12 });
		const largest = plainToInstance(UpdateCandidateDTO, { billRateValue: 999999999999.99 });

		expect(await rateErrors(tooBig)).toEqual(['billRateValue']);
		expect(await rateErrors(largest)).toEqual([]);
	});

	it("keeps parseInt's leading-number parsing and still rejects non-numeric rates", async () => {
		const loose = plainToInstance(UpdateCandidateDTO, { billRateValue: '10,50' });
		const invalid = plainToInstance(UpdateCandidateDTO, { billRateValue: 'abc' });

		expect(loose.billRateValue).toBe(10);
		expect(await rateErrors(loose)).toEqual([]);
		expect(await rateErrors(invalid)).toEqual(['billRateValue']);
	});
});
