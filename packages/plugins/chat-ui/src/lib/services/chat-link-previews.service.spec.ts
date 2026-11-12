// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { ChatLinkPreviewStatusEnum, IChatLinkPreview } from '@gauzy/contracts';
import { CHAT_LINK_PREVIEW_CONCURRENCY, CHAT_LINK_PREVIEW_PICTURES_MAX, CHAT_LINK_PREVIEW_RETRY_MS, ChatLinkPreviewsService, textOf } from './chat-link-previews.service';
import { ChatAvailabilityService, ChatScope } from './chat-availability.service';
import { ChatUiService } from './chat-ui.service';

const LINK = 'https://www.example.com/post';
const ready = (url: string, fields: Partial<IChatLinkPreview> = {}): IChatLinkPreview => ({
	url,
	status: ChatLinkPreviewStatusEnum.READY,
	title: 'A post',
	description: 'About it',
	siteName: 'Example',
	image: 'https://cdn.example.com/a.png',
	icon: 'https://www.example.com/favicon.ico',
	...fields
});

describe('ChatLinkPreviewsService', () => {
	let answer: (url: string) => Observable<IChatLinkPreview>;
	let picture: (url: string) => Observable<Blob>;
	let linkPreview: jest.Mock;
	let linkPreviewImage: jest.Mock;
	let service: ChatLinkPreviewsService;

	const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

	beforeEach(() => {
		answer = (url) => of(ready(url));
		// The platform's pictures are off unless a spec says otherwise.
		picture = (url) => throwError(() => new HttpErrorResponse({ status: 404, url }));
		linkPreview = jest.fn((url: string) => answer(url));
		linkPreviewImage = jest.fn((url: string) => picture(url));
		(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = jest.fn(() => 'blob:picture');
		TestBed.configureTestingModule({
			providers: [
				{ provide: ChatUiService, useValue: { linkPreview, linkPreviewImage } },
				{ provide: ChatAvailabilityService, useValue: { scope$: new BehaviorSubject<ChatScope | null>({ userId: 'u1', organizationId: 'o1' }) } }
			]
		});
		service = TestBed.inject(ChatLinkPreviewsService);
	});

	afterEach(() => jest.useRealTimers());

	it('asks once per link, and answers its text: never the address of the picture or icon of the linked site', async () => {
		const first = service.preview(LINK);
		expect(first()).toBeNull();
		await flush();
		expect(first()).toEqual({ siteName: 'Example', title: 'A post', description: 'About it', imageUrl: null, imageAlt: null });
		expect(service.preview(LINK)()).toEqual(first());
		expect(linkPreview).toHaveBeenCalledTimes(1);
		expect(linkPreview).toHaveBeenCalledWith(LINK);
	});

	it('does not ask while a template reads it: the ask starts afterwards', () => {
		service.preview(LINK);
		expect(linkPreview).not.toHaveBeenCalled();
	});

	it('asks a pending preview again after a moment, a few times at most', async () => {
		jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
		let asked = 0;
		answer = (url) => {
			asked++;
			return of(asked < 3 ? { url, status: ChatLinkPreviewStatusEnum.PENDING } : ready(url));
		};
		const preview = service.preview(LINK);
		await flush();
		expect(preview()).toBeNull();
		jest.advanceTimersByTime(CHAT_LINK_PREVIEW_RETRY_MS);
		expect(preview()).toBeNull();
		// Each time a little later.
		jest.advanceTimersByTime(CHAT_LINK_PREVIEW_RETRY_MS);
		expect(linkPreview).toHaveBeenCalledTimes(2);
		jest.advanceTimersByTime(CHAT_LINK_PREVIEW_RETRY_MS);
		expect(preview()?.title).toBe('A post');
		expect(linkPreview).toHaveBeenCalledTimes(3);

		// One that stays pending is given up on.
		answer = (url) => of({ url, status: ChatLinkPreviewStatusEnum.PENDING });
		const stuck = service.preview('https://www.example.com/slow');
		await flush();
		jest.advanceTimersByTime(CHAT_LINK_PREVIEW_RETRY_MS * 10);
		expect(stuck()).toBeNull();
		expect(linkPreview).toHaveBeenCalledTimes(3 + 4);
	});

	it('leaves the card as it is for an unavailable preview, one with no text, or a refusal, and asks those no more', async () => {
		jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
		answer = (url) =>
			url.endsWith('/gone')
				? of({ url, status: ChatLinkPreviewStatusEnum.UNAVAILABLE })
				: url.endsWith('/bare')
					? of(ready(url, { title: '  ', description: null }))
					: throwError(() => new HttpErrorResponse({ status: 400 }));
		const previews = ['/gone', '/bare', '/refused'].map((path) => service.preview(`https://www.example.com${path}`));
		await flush();
		jest.advanceTimersByTime(CHAT_LINK_PREVIEW_RETRY_MS * 10);
		expect(previews.map((preview) => preview())).toEqual([null, null, null]);
		expect(linkPreview).toHaveBeenCalledTimes(3);
	});

	it('asks again after a failure that may pass: no connection, 429, 5xx', async () => {
		jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
		const failures = [0, 429, 503];
		answer = (url) => {
			const status = failures.shift();
			return status === undefined ? of(ready(url)) : throwError(() => new HttpErrorResponse({ status }));
		};
		const preview = service.preview(LINK);
		await flush();
		jest.advanceTimersByTime(CHAT_LINK_PREVIEW_RETRY_MS * 6);
		expect(linkPreview).toHaveBeenCalledTimes(4);
		expect(preview()?.title).toBe('A post');
	});

	it('stops asking for the session once the platform says its previews are off', async () => {
		answer = () => throwError(() => new HttpErrorResponse({ status: 404 }));
		service.preview('https://www.example.com/1');
		await flush();
		service.preview('https://www.example.com/2');
		await flush();
		expect(linkPreview).toHaveBeenCalledTimes(1);
	});

	it('asks a few at a time', async () => {
		const answers = new Map<string, Subject<IChatLinkPreview>>();
		answer = (url) => {
			const subject = new Subject<IChatLinkPreview>();
			answers.set(url, subject);
			return subject;
		};
		const links = Array.from({ length: CHAT_LINK_PREVIEW_CONCURRENCY + 2 }, (_, n) => `https://www.example.com/${n}`);
		links.forEach((link) => service.preview(link));
		await flush();
		expect(linkPreview).toHaveBeenCalledTimes(CHAT_LINK_PREVIEW_CONCURRENCY);
		const first = answers.get(links[0])!;
		first.next(ready(links[0]));
		first.complete();
		expect(linkPreview).toHaveBeenCalledTimes(CHAT_LINK_PREVIEW_CONCURRENCY + 1);
	});
});

describe('ChatLinkPreviewsService: pictures', () => {
	let picture: jest.Mock;
	let scope$: BehaviorSubject<ChatScope | null>;
	let service: ChatLinkPreviewsService;
	const flush = async () => {
		for (let n = 0; n < 3; n++) await new Promise<void>((resolve) => queueMicrotask(resolve));
	};

	beforeEach(() => {
		picture = jest.fn(() => of(new Blob(['bytes'], { type: 'image/png' })));
		scope$ = new BehaviorSubject<ChatScope | null>({ userId: 'u1', organizationId: 'o1' });
		(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = jest.fn(() => 'blob:picture');
		(URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = jest.fn();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: ChatUiService,
					useValue: { linkPreview: (url: string) => of(ready(url, { imageAlt: 'A cover' })), linkPreviewImage: picture }
				},
				{ provide: ChatAvailabilityService, useValue: { scope$ } }
			]
		});
		service = TestBed.inject(ChatLinkPreviewsService);
	});

	it('shows the picture the platform served, as a blob URL of its own fetch', async () => {
		const preview = service.preview(LINK);
		await flush();
		expect(picture).toHaveBeenCalledWith(LINK);
		expect(preview()).toMatchObject({ title: 'A post', imageUrl: 'blob:picture', imageAlt: 'A cover' });
		expect(preview()?.imageUrl).not.toContain('cdn.example.com');
	});

	it('keeps a bounded number of pictures: the least recently shown is released, its URL revoked and its card back to text', async () => {
		let made = 0;
		(URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = jest.fn(() => `blob:picture-${made++}`);
		const revoke = jest.fn();
		(URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = revoke;
		const links = Array.from({ length: CHAT_LINK_PREVIEW_PICTURES_MAX + 1 }, (_, n) => `https://www.example.com/${n}`);
		const previews = [];
		for (const link of links) {
			previews.push(service.preview(link));
			await flush();
		}
		expect(revoke).toHaveBeenCalledWith('blob:picture-0');
		expect(previews[0]()?.imageUrl).toBeNull();
		expect(previews[previews.length - 1]()?.imageUrl).toBe(`blob:picture-${CHAT_LINK_PREVIEW_PICTURES_MAX}`);
		expect(revoke).toHaveBeenCalledTimes(1);
	});

	it('keeps asking for the pictures of other links when one link has none to serve (204)', async () => {
		picture.mockImplementationOnce(() => of(null)).mockImplementation(() => of(new Blob(['bytes'], { type: 'image/png' })));
		const first = service.preview(LINK);
		await flush();
		const second = service.preview('https://www.example.com/other');
		await flush();
		expect(picture).toHaveBeenCalledTimes(2);
		expect(first()?.imageUrl).toBeNull();
		expect(second()?.imageUrl).toBe('blob:picture');
	});

	it('drops what it kept when the person or the organization changes, and the answers still on their way', async () => {
		const revoke = (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL;
		const before = service.preview(LINK);
		await flush();
		expect(before()?.imageUrl).toBe('blob:picture');
		// An answer for the old scope still on its way when the scope changes.
		const late = new Subject<Blob>();
		picture.mockImplementationOnce(() => late);
		const slow = service.preview('https://www.example.com/slow');
		await flush();
		scope$.next({ userId: 'u1', organizationId: 'o2' });
		expect(revoke).toHaveBeenCalledWith('blob:picture');
		expect(before()?.imageUrl).toBeNull();
		late.next(new Blob(['late'], { type: 'image/png' }));
		late.complete();
		expect(slow()?.imageUrl ?? null).toBeNull();
		// The new scope asks again.
		const after = service.preview(LINK);
		expect(after).not.toBe(before);
		await flush();
		expect(after()?.title).toBe('A post');
	});

	it('asks for no more pictures once the platform says it serves none', async () => {
		picture.mockImplementation(() => throwError(() => new HttpErrorResponse({ status: 404 })));
		const first = service.preview(LINK);
		await flush();
		const second = service.preview('https://www.example.com/other');
		await flush();
		expect(picture).toHaveBeenCalledTimes(1);
		expect(first()?.imageUrl).toBeNull();
		expect(second()?.title).toBe('A post');
		expect(second()?.imageUrl).toBeNull();
	});
});

describe('textOf', () => {
	it('keeps the site, the title and the description, trimmed', () => {
		expect(textOf(ready(LINK, { siteName: ' Site ', title: ' T ', description: undefined }))).toEqual({
			siteName: 'Site',
			title: 'T',
			description: null,
			imageUrl: null,
			imageAlt: null
		});
		expect(textOf(ready(LINK, { title: null, description: null }))).toBeNull();
	});
});
