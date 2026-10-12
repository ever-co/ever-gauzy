import moment from 'moment-timezone';
import { TimeFormatEnum, TimeZoneEnum } from '@gauzy/contracts';
import {
	DEFAULT_MOMENT_TIMEZONE,
	getTimeZoneWithOffset,
	normalizeTimeFormat,
	normalizeTimeZoneOption,
	resolveMomentTimezone
} from './timezone.utils';

describe('timezone.utils — button label (Angular `getTimeZoneWithOffset` parity)', () => {
	const summer = moment.utc('2026-07-15T12:00:00Z');
	const winter = moment.utc('2026-01-15T12:00:00Z');

	it('renders "<abbr>: <Region> - <City>" (first underscore replaced, like Angular)', () => {
		expect(getTimeZoneWithOffset('Europe/Isle_of_Man', summer)).toBe('BST: Europe - Isle of_Man');
		expect(getTimeZoneWithOffset('Europe/Isle_of_Man', winter)).toBe('GMT: Europe - Isle of_Man');
		expect(getTimeZoneWithOffset('America/New_York', summer)).toBe('EDT: America - New York');
	});

	it('leaves the region empty for zones without a slash', () => {
		expect(getTimeZoneWithOffset('UTC', summer)).toBe('UTC:  - UTC');
		expect(getTimeZoneWithOffset('Etc/UTC', summer)).toBe('UTC: Etc - UTC');
	});
});

describe('timezone.utils — option → IANA zone (Angular `getMomentTimezone` parity)', () => {
	const sources = { userTimeZone: 'Asia/Kolkata', organizationTimeZone: 'Europe/Sofia' };

	it('maps mine / org / utc', () => {
		expect(resolveMomentTimezone(TimeZoneEnum.MINE_TIMEZONE, sources)).toBe('Asia/Kolkata');
		expect(resolveMomentTimezone(TimeZoneEnum.ORG_TIMEZONE, sources)).toBe('Europe/Sofia');
		expect(resolveMomentTimezone(TimeZoneEnum.UTC_TIMEZONE, sources)).toBe(DEFAULT_MOMENT_TIMEZONE);
		expect(resolveMomentTimezone('garbage', sources)).toBe(DEFAULT_MOMENT_TIMEZONE);
		expect(resolveMomentTimezone(undefined, sources)).toBe(DEFAULT_MOMENT_TIMEZONE);
	});

	it('falls back to the browser guess (mine) and UTC (org)', () => {
		expect(resolveMomentTimezone(TimeZoneEnum.MINE_TIMEZONE, {}, () => 'Pacific/Auckland')).toBe('Pacific/Auckland');
		expect(resolveMomentTimezone(TimeZoneEnum.ORG_TIMEZONE, {})).toBe(DEFAULT_MOMENT_TIMEZONE);
	});
});

describe('timezone.utils — normalisation of query params / settings', () => {
	it('only org and mine survive; everything else is UTC', () => {
		expect(normalizeTimeZoneOption('org')).toBe(TimeZoneEnum.ORG_TIMEZONE);
		expect(normalizeTimeZoneOption('mine')).toBe(TimeZoneEnum.MINE_TIMEZONE);
		expect(normalizeTimeZoneOption('utc')).toBe(TimeZoneEnum.UTC_TIMEZONE);
		expect(normalizeTimeZoneOption('Europe/Sofia')).toBe(TimeZoneEnum.UTC_TIMEZONE);
		expect(normalizeTimeZoneOption(undefined)).toBe(TimeZoneEnum.UTC_TIMEZONE);
	});

	it('only 24 (number or string) yields the 24-hour format', () => {
		expect(normalizeTimeFormat(24)).toBe(TimeFormatEnum.FORMAT_24_HOURS);
		expect(normalizeTimeFormat('24')).toBe(TimeFormatEnum.FORMAT_24_HOURS);
		expect(normalizeTimeFormat(12)).toBe(TimeFormatEnum.FORMAT_12_HOURS);
		expect(normalizeTimeFormat(undefined)).toBe(TimeFormatEnum.FORMAT_12_HOURS);
		expect(normalizeTimeFormat('nope')).toBe(TimeFormatEnum.FORMAT_12_HOURS);
	});
});
