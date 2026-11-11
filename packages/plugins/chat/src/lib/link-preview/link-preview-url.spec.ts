import { isChatLinkPreviewsEnabled } from './chat-link-preview-enabled';
import { LinkPreviewUrlError, normalizePreviewUrl, previewTargetRefusal, previewUrlHash } from './link-preview-url';

describe('normalizePreviewUrl', () => {
	it('keys a link by its normal form, without the fragment', () => {
		const url = normalizePreviewUrl('  HTTPS://Example.COM:443/a/b?q=1#section ');
		expect(url.href).toBe('https://example.com/a/b?q=1');
		expect(previewUrlHash(url)).toBe(previewUrlHash('https://example.com/a/b?q=1'));
		expect(previewUrlHash(url)).toMatch(/^[0-9a-f]{64}$/);
	});

	it.each(['', '   ', 'not a url', '/relative/path', 'ftp://example.com/file', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:secret@example.com/'])(
		'refuses %p',
		(value) => {
			expect(() => normalizePreviewUrl(value)).toThrow(LinkPreviewUrlError);
		}
	);

	it('refuses a link longer than the limit, and a value that is not text', () => {
		expect(() => normalizePreviewUrl(`https://example.com/${'a'.repeat(2048)}`)).toThrow(LinkPreviewUrlError);
		expect(() => normalizePreviewUrl(42)).toThrow(LinkPreviewUrlError);
	});
});

describe('previewTargetRefusal', () => {
	it('is the refusal of the egress guard', () => {
		expect(previewTargetRefusal(new URL('http://169.254.169.254/'))).toBe('address');
		expect(previewTargetRefusal(new URL('http://localhost/'))).toBe('hostname');
		expect(previewTargetRefusal(new URL('https://example.com/'))).toBeNull();
	});
});

describe('isChatLinkPreviewsEnabled', () => {
	it('is on only for exactly "true", and reports any other value once without repeating it', () => {
		const warn = jest.fn();
		expect(isChatLinkPreviewsEnabled({}, warn)).toBe(false);
		expect(isChatLinkPreviewsEnabled({ GAUZY_CHAT_LINK_PREVIEWS_ENABLED: '' }, warn)).toBe(false);
		expect(isChatLinkPreviewsEnabled({ GAUZY_CHAT_LINK_PREVIEWS_ENABLED: 'false' }, warn)).toBe(false);
		expect(warn).not.toHaveBeenCalled();
		expect(isChatLinkPreviewsEnabled({ GAUZY_CHAT_LINK_PREVIEWS_ENABLED: 'TRUE' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).not.toContain('TRUE');
		expect(isChatLinkPreviewsEnabled({ GAUZY_CHAT_LINK_PREVIEWS_ENABLED: 'true' }, warn)).toBe(true);
	});
});
