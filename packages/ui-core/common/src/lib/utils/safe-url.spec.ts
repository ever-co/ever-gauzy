import { escapeHtml, openInNewTab, toHttpUrl } from './safe-url';

describe('safe-url', () => {
	const BASE = 'https://app.gauzy.test/#/pages/employees/time-off';

	describe('toHttpUrl', () => {
		it('keeps http(s) links, and reads a relative one against the page', () => {
			expect(toHttpUrl('https://files.test/a.pdf', BASE)?.href).toBe('https://files.test/a.pdf');
			expect(toHttpUrl(' http://files.test/a.pdf ', BASE)?.href).toBe('http://files.test/a.pdf');
			expect(toHttpUrl('/public/forms/a.pdf', BASE)?.href).toBe('https://app.gauzy.test/public/forms/a.pdf');
		});

		it.each([
			['javascript:alert(document.cookie)'],
			['JavaScript:alert(1)'],
			['data:text/html,<script>alert(1)</script>'],
			['blob:https://app.gauzy.test/0d8f'],
			['file:///etc/passwd'],
			[''],
			['   '],
			[null],
			[undefined],
			[42]
		])('refuses %p', (url) => {
			expect(toHttpUrl(url, BASE)).toBeNull();
		});
	});

	describe('openInNewTab', () => {
		let openMock: jest.SpyInstance;

		afterEach(() => openMock?.mockRestore());

		it('opens a blank tab, cuts its way back to this page, then points it at the link', () => {
			const tab = { opener: window, location: { href: 'about:blank' } };
			openMock = jest.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);

			expect(openInNewTab('https://files.test/form.pdf')).toBe('opened');

			expect(openMock).toHaveBeenCalledWith('', '_blank');
			expect(tab.opener).toBeNull();
			expect(tab.location.href).toBe('https://files.test/form.pdf');
		});

		it('says `blocked` when the browser refuses the tab', () => {
			openMock = jest.spyOn(window, 'open').mockImplementation(() => null);

			expect(openInNewTab('https://files.test/form.pdf')).toBe('blocked');
		});

		it('opens nothing for a link that is not http(s)', () => {
			openMock = jest.spyOn(window, 'open').mockImplementation(() => null);

			expect(openInNewTab('javascript:alert(1)')).toBe('invalid');
			expect(openMock).not.toHaveBeenCalled();
		});
	});

	describe('escapeHtml', () => {
		it('escapes what could close an attribute or open a tag', () => {
			expect(escapeHtml(`https://x.test/?a=1&b="2"'<x>`)).toBe(
				'https://x.test/?a=1&amp;b=&quot;2&quot;&#39;&lt;x&gt;'
			);
		});
	});
});
