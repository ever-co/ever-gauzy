// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ChatLinkPreviewStatusEnum, IChatLinkPreview } from '@gauzy/contracts';
import { CHAT_LINK_PREVIEW_CONCURRENCY, CHAT_LINK_PREVIEW_RETRY_MS, ChatLinkPreviewsService, textOf } from './chat-link-previews.service';
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
	let linkPreview: jest.Mock;
	let service: ChatLinkPreviewsService;

	const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

	beforeEach(() => {
		answer = (url) => of(ready(url));
		linkPreview = jest.fn((url: string) => answer(url));
		TestBed.configureTestingModule({ providers: [{ provide: ChatUiService, useValue: { linkPreview } }] });
		service = TestBed.inject(ChatLinkPreviewsService);
	});

	afterEach(() => jest.useRealTimers());

	it('asks once per link, and answers the text only: no picture, no icon', async () => {
		const first = service.preview(LINK);
		expect(first()).toBeNull();
		await flush();
		expect(first()).toEqual({ siteName: 'Example', title: 'A post', description: 'About it' });
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

	it('leaves the card as it is for an unavailable preview, one with no text, or a failure', async () => {
		answer = (url) =>
			url.endsWith('/gone')
				? of({ url, status: ChatLinkPreviewStatusEnum.UNAVAILABLE })
				: url.endsWith('/bare')
					? of(ready(url, { title: '  ', description: null }))
					: throwError(() => new HttpErrorResponse({ status: 500 }));
		const previews = ['/gone', '/bare', '/broken'].map((path) => service.preview(`https://www.example.com${path}`));
		await flush();
		expect(previews.map((preview) => preview())).toEqual([null, null, null]);
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

describe('textOf', () => {
	it('keeps the site, the title and the description, trimmed', () => {
		expect(textOf(ready(LINK, { siteName: ' Site ', title: ' T ', description: undefined }))).toEqual({ siteName: 'Site', title: 'T', description: null });
		expect(textOf(ready(LINK, { title: null, description: null }))).toBeNull();
	});
});
