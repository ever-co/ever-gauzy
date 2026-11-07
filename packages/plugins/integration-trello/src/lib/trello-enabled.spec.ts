import { isTrelloEnabled } from './trello-enabled';

describe('isTrelloEnabled', () => {
	it('is on only for exactly "true"', () => {
		expect(isTrelloEnabled({ TRELLO_ENABLED: 'true' })).toBe(true);
		expect(isTrelloEnabled({ TRELLO_ENABLED: 'false' })).toBe(false);
		expect(isTrelloEnabled({ TRELLO_ENABLED: '' })).toBe(false);
		expect(isTrelloEnabled({})).toBe(false);
	});

	it('reports any other value once, without repeating it', () => {
		const warn = jest.fn();
		expect(isTrelloEnabled({ TRELLO_ENABLED: 'TRUE' }, warn)).toBe(false);
		expect(isTrelloEnabled({ TRELLO_ENABLED: '1' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(2);
		expect(String(warn.mock.calls[0][0])).not.toContain('TRUE');
	});
});
