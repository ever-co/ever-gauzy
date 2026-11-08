import { errorText, isNotFound, sectionMapOf } from './asana-ui.utils';

describe('asana-ui.utils', () => {
	it('reads the API message of an error, in its shapes, else a generic line', () => {
		expect(errorText({ error: { message: 'No.' } })).toBe('No.');
		expect(errorText({ error: { message: ['one', 'two'] } })).toBe('one two');
		expect(errorText({ error: { error: { message: ' nested ' } } })).toBe('nested');
		expect(errorText({ error: 'plain' })).toBe('plain');
		expect(errorText(null)).toBe('The request failed. Please try again.');
		expect(isNotFound({ status: 404 })).toBe(true);
		expect(isNotFound({ status: 400 })).toBe(false);
	});

	it('keeps only the sections given a status, trimmed', () => {
		expect(
			sectionMapOf([
				{ gid: 's-1', status: ' in-progress ' },
				{ gid: 's-2', status: '' },
				{ gid: '', status: 'open' }
			])
		).toEqual({ 's-1': 'in-progress' });
	});
});
