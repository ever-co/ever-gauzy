import { Observable, of, Subject, throwError } from 'rxjs';
import { ChatLinkPreview, ChatLinkPreviewCache, ChatLinkPreviewTiming, imageAspectRatio, safeHttpsUrl, shownPreview } from './chat-link-previews';

const TIMING: ChatLinkPreviewTiming = { pendingRetryMs: 2_000, pendingRetries: 3 };
const A = 'https://example.com/a';
const B = 'https://example.com/b';
const C = 'https://example.org/c';

function ready(url: string, extra: Partial<ChatLinkPreview> = {}): ChatLinkPreview {
	return { url, status: 'ready', title: `Title of ${url}`, description: 'About it', siteName: 'Example', image: 'https://cdn.example.com/p.png', imageWidth: 1200, imageHeight: 630, icon: 'https://example.com/favicon.png', ...extra };
}

/** A platform whose answers the case sets per call: a value, a refusal (`{ status }`), or one to answer later. */
function platform() {
	const answers: Array<() => Observable<ChatLinkPreview>> = [];
	const fetch = jest.fn((_url: string) => (answers.shift() ?? (() => of(ready(_url))))());
	const cache = new ChatLinkPreviewCache(fetch, TIMING);
	const seen = (url: string) => {
		const values: Array<ChatLinkPreview | null> = [];
		cache.preview(url).subscribe((value) => values.push(value));
		return values;
	};
	return { answers, fetch, cache, seen };
}

const refusal = (status: number) => () => throwError(() => ({ status }));

describe('ChatLinkPreviewCache', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('asks once per distinct link, whatever the number of messages that show it', () => {
		const { fetch, seen } = platform();
		const first = seen(A);
		const second = seen(A);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(first[0]?.title).toBe(`Title of ${A}`);
		expect(second).toEqual(first);
	});

	it('asks a pending link again every 2 s, three times at most, then leaves the card link-only', () => {
		const { answers, fetch, seen } = platform();
		for (let i = 0; i < 4; i++) answers.push(() => of({ url: A, status: 'pending' }));
		const values = seen(A);
		expect(fetch).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(1_999);
		expect(fetch).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(1);
		expect(fetch).toHaveBeenCalledTimes(2);
		jest.advanceTimersByTime(4_000);
		expect(fetch).toHaveBeenCalledTimes(4);
		jest.advanceTimersByTime(10_000);
		expect(fetch).toHaveBeenCalledTimes(4);
		expect(values).toEqual([null]);
	});

	it('shows a pending link once it is ready', () => {
		const { answers, seen } = platform();
		answers.push(() => of({ url: A, status: 'pending' }));
		answers.push(() => of(ready(A)));
		const values = seen(A);
		expect(values).toEqual([]);
		jest.advanceTimersByTime(2_000);
		expect(values).toHaveLength(1);
		expect(values[0]?.status).toBe('ready');
	});

	it('keeps an unavailable link link-only and does not ask again this session', () => {
		const { answers, fetch, seen } = platform();
		answers.push(() => of({ url: A, status: 'unavailable' }));
		expect(seen(A)).toEqual([null]);
		expect(seen(A)).toEqual([null]);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('turns previews off for the session on a 404: one probe, the links waiting for it and later ones ask nothing', () => {
		const { answers, fetch, cache, seen } = platform();
		const probe = new Subject<ChatLinkPreview>();
		answers.push(() => probe);
		const a = seen(A);
		const b = seen(B);
		// B waits for the probe instead of asking at the same time.
		expect(fetch).toHaveBeenCalledTimes(1);
		probe.error({ status: 404 });
		expect(a).toEqual([null]);
		expect(b).toEqual([null]);
		expect(cache.off).toBe(true);
		expect(seen(C)).toEqual([null]);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('lets the links waiting for the probe through once it answers anything else', () => {
		const { answers, fetch, seen } = platform();
		const probe = new Subject<ChatLinkPreview>();
		answers.push(() => probe);
		seen(A);
		const b = seen(B);
		probe.next({ url: A, status: 'unavailable' });
		probe.complete();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(b[0]?.title).toBe(`Title of ${B}`);
	});

	it('takes a 400 as a link the platform does not preview: link-only, not asked again, previews still on', () => {
		const { answers, fetch, cache, seen } = platform();
		answers.push(refusal(400));
		expect(seen(A)).toEqual([null]);
		expect(seen(A)).toEqual([null]);
		expect(cache.off).toBe(false);
		expect(seen(B)[0]?.status).toBe('ready');
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('asks again after a passing failure (throttled, the API away), and a failed probe lets the next one probe', () => {
		const { answers, fetch, seen } = platform();
		const probe = new Subject<ChatLinkPreview>();
		answers.push(() => probe);
		const a = seen(A);
		const b = seen(B);
		probe.error({ status: 429 });
		expect(a).toEqual([null]);
		// The waiting link gives up for now too, without asking.
		expect(b).toEqual([null]);
		expect(fetch).toHaveBeenCalledTimes(1);

		answers.push(refusal(503));
		expect(seen(A)).toEqual([null]);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(seen(B)[0]?.status).toBe('ready');
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('asks again for another user or organization', () => {
		const { answers, fetch, cache, seen } = platform();
		answers.push(refusal(404));
		seen(A);
		expect(cache.off).toBe(true);
		cache.reset();
		expect(cache.off).toBe(false);
		expect(seen(A)[0]?.status).toBe('ready');
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('drops an answer that comes after a reset', () => {
		const { answers, cache, seen } = platform();
		const late = new Subject<ChatLinkPreview>();
		answers.push(() => late);
		seen(A);
		cache.reset();
		late.error({ status: 404 });
		expect(cache.off).toBe(false);
	});
});

describe('link preview helpers', () => {
	it('shows a ready preview with something in it, its picture and icon only from https', () => {
		const shown = shownPreview(ready(A, { image: 'http://cdn.example.com/p.png', icon: 'javascript:alert(1)' }));
		expect(shown?.image).toBeNull();
		expect(shown?.icon).toBeNull();
		expect(shown?.title).toBe(`Title of ${A}`);
		expect(shownPreview({ url: A, status: 'ready', title: '  ', description: null })).toBeNull();
		expect(shownPreview({ url: A, status: 'pending', title: 'x' })).toBeNull();
		expect(shownPreview(null)).toBeNull();
	});

	it('keeps only absolute https URLs', () => {
		expect(safeHttpsUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
		expect(safeHttpsUrl('http://cdn.example.com/a.png')).toBeNull();
		expect(safeHttpsUrl('/relative.png')).toBeNull();
		expect(safeHttpsUrl('data:image/png;base64,AAAA')).toBeNull();
		expect(safeHttpsUrl(undefined)).toBeNull();
	});

	it('lays the picture out at its own aspect ratio when its size is known', () => {
		expect(imageAspectRatio({ imageWidth: 1200, imageHeight: 630 })).toBe('1200 / 630');
		expect(imageAspectRatio({ imageWidth: 0, imageHeight: 630 })).toBeNull();
		expect(imageAspectRatio({ imageWidth: null, imageHeight: undefined })).toBeNull();
	});
});
