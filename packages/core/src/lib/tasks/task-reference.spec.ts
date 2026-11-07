import {
	derivedProjectKey,
	derivedTaskPrefix,
	isValidTaskKey,
	keysOfProject,
	normalizeTaskKey,
	parseTaskReference,
	parseTaskReferences,
	uniqueProjectKey
} from './task-reference';

describe('task references', () => {
	it('normalizes and validates keys', () => {
		expect(normalizeTaskKey(' api ')).toBe('API');
		expect(normalizeTaskKey('A1B2')).toBe('A1B2');
		expect(normalizeTaskKey('1AB')).toBeNull();
		expect(normalizeTaskKey('A')).toBeNull();
		expect(normalizeTaskKey('TOOLONGKEY1')).toBeNull();
		expect(normalizeTaskKey('A-B')).toBeNull();
		expect(isValidTaskKey('API')).toBe(true);
		expect(isValidTaskKey('api')).toBe(false);
		expect(isValidTaskKey(42)).toBe(false);
	});

	it('derives a key and the task prefix from a project name', () => {
		expect(derivedProjectKey('Fulfilment')).toBe('FUL');
		expect(derivedProjectKey('3D Print')).toBe('3DP');
		expect(derivedProjectKey('A')).toBeNull();
		expect(derivedProjectKey('')).toBeNull();
		expect(derivedTaskPrefix('Fulfilment')).toBe('Ful');
		expect(derivedTaskPrefix('')).toBeNull();
	});

	it('parses references out of text, once each, in order', () => {
		expect(parseTaskReference('see API-42 please')).toEqual({ key: 'API', number: 42, reference: 'API-42' });
		expect(parseTaskReferences('API-42 and api-42, then WEB-7; not ABC-0 nor x-1 nor UUID-1234567890 nor A-B-1').map((r) => `${r.key}-${r.number}`)).toEqual([
			'API-42',
			'WEB-7'
		]);
		expect(parseTaskReferences('https://x/tasks/API-42#c')).toEqual([{ key: 'API', number: 42, reference: 'API-42' }]);
		expect(parseTaskReference('nothing here')).toBeNull();
		expect(parseTaskReferences(null)).toEqual([]);
	});

	it('lists every key a project answers to', () => {
		expect(keysOfProject({ name: 'Fulfilment', taskKey: 'SHIP', taskKeyHistory: ['ful', 'SHIP', 'bad key'] })).toEqual(['SHIP', 'FUL']);
		expect(keysOfProject({ name: 'Fulfilment' })).toEqual(['FUL']);
		expect(keysOfProject({ name: '' })).toEqual([]);
	});

	it('picks a free key for a new project', () => {
		expect(uniqueProjectKey('Fulfilment', [])).toBe('FUL');
		expect(uniqueProjectKey('Fulfilment', ['FUL'])).toBe('FUL2');
		expect(uniqueProjectKey('Fulfilment', ['ful', 'FUL2'])).toBe('FUL3');
		expect(uniqueProjectKey('A', [])).toBeNull();
	});
});
