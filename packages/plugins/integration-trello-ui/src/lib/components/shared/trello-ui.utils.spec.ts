import { errorText, isNotFound, listMapOf, tokenOfFragment } from './trello-ui.utils';

describe('trello-ui.utils', () => {
	it('reads the API message of an error, in its shapes, else a generic line', () => {
		expect(errorText({ error: { message: 'No.' } })).toBe('No.');
		expect(errorText({ error: { message: ['one', 'two'] } })).toBe('one two');
		expect(errorText({ error: 'plain' })).toBe('plain');
		expect(errorText(null)).toBe('The request failed. Please try again.');
		expect(isNotFound({ status: 404 })).toBe(true);
		expect(isNotFound({ status: 400 })).toBe(false);
	});

	it('reads the token Trello returns in the fragment, and nothing else', () => {
		expect(tokenOfFragment('token=abc123')).toBe('abc123');
		expect(tokenOfFragment('#token=abc123&other=1')).toBe('abc123');
		expect(tokenOfFragment('token=')).toBeNull();
		expect(tokenOfFragment('error=denied')).toBeNull();
		expect(tokenOfFragment('token=not safe!')).toBeNull();
		expect(tokenOfFragment(null)).toBeNull();
	});

	it('keeps only the lists given a status, trimmed', () => {
		expect(
			listMapOf([
				{ id: 'l-1', status: ' in-progress ' },
				{ id: 'l-2', status: '' },
				{ id: '', status: 'open' }
			])
		).toEqual({ 'l-1': 'in-progress' });
	});
});
