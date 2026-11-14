import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { ITimeLog, TimeLogType } from '@gauzy/contracts';
import {
	assertBreakOverlapsNothing,
	assertBreaksAllowedIn,
	assertBreakTypeKept,
	BREAK_OVERLAP,
	BREAK_TYPE_LOCKED,
	BREAKS_NOT_ALLOWED,
	isBreak
} from './break-rules';

/** The HTTP error `act` throws, or undefined when it throws nothing. */
function refusalOf(act: () => void): HttpException | undefined {
	try {
		act();
		return undefined;
	} catch (error) {
		return error as HttpException;
	}
}

describe('break rules', () => {
	it('tells a break from every other type', () => {
		expect(isBreak({ logType: TimeLogType.BREAK })).toBe(true);
		for (const logType of [TimeLogType.TRACKED, TimeLogType.MANUAL, TimeLogType.IDLE, TimeLogType.RESUMED]) {
			expect(isBreak({ logType })).toBe(false);
		}
		expect(isBreak(undefined)).toBe(false);
	});

	it('allows breaks only in an organization whose switch is true', () => {
		expect(refusalOf(() => assertBreaksAllowedIn({ allowBreaks: true }))).toBeUndefined();

		for (const organization of [{ allowBreaks: false }, { allowBreaks: null }, {}, undefined]) {
			const refusal = refusalOf(() => assertBreaksAllowedIn(organization as never));
			expect(refusal).toBeInstanceOf(ForbiddenException);
			expect(refusal?.getResponse()).toMatchObject({ code: BREAKS_NOT_ALLOWED });
		}
	});

	it('refuses a break over any entry, and lets one through over none', () => {
		expect(refusalOf(() => assertBreakOverlapsNothing([]))).toBeUndefined();
		expect(refusalOf(() => assertBreakOverlapsNothing(undefined))).toBeUndefined();

		const refusal = refusalOf(() => assertBreakOverlapsNothing([{ id: 'work' } as ITimeLog]));
		expect(refusal).toBeInstanceOf(ConflictException);
		expect(refusal?.getResponse()).toMatchObject({ code: BREAK_OVERLAP });
	});

	it('keeps a break a break and work work, and lets an edit that names no type through', () => {
		expect(refusalOf(() => assertBreakTypeKept({ logType: TimeLogType.BREAK }, TimeLogType.BREAK))).toBeUndefined();
		expect(
			refusalOf(() => assertBreakTypeKept({ logType: TimeLogType.MANUAL }, TimeLogType.TRACKED))
		).toBeUndefined();
		expect(refusalOf(() => assertBreakTypeKept({ logType: TimeLogType.BREAK }, undefined))).toBeUndefined();

		const intoWork = refusalOf(() => assertBreakTypeKept({ logType: TimeLogType.BREAK }, TimeLogType.MANUAL));
		const intoBreak = refusalOf(() => assertBreakTypeKept({ logType: TimeLogType.MANUAL }, TimeLogType.BREAK));
		expect(intoWork?.getResponse()).toMatchObject({ code: BREAK_TYPE_LOCKED });
		expect(intoBreak?.getResponse()).toMatchObject({ code: BREAK_TYPE_LOCKED });
	});
});
