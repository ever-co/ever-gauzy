// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { CUSTOM_ELEMENTS_SCHEMA, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatLinkPreviewsService, ChatLinkPreviewText } from '../../services/chat-link-previews.service';
import { LinkCardsComponent } from './link-cards.component';

describe('LinkCardsComponent', () => {
	const previews = new Map<string, WritableSignal<ChatLinkPreviewText | null>>();
	const preview = jest.fn((url: string) => {
		if (!previews.has(url)) previews.set(url, signal<ChatLinkPreviewText | null>(null));
		return previews.get(url)!.asReadonly();
	});

	beforeEach(() => {
		previews.clear();
		preview.mockClear();
		TestBed.configureTestingModule({ providers: [{ provide: ChatLinkPreviewsService, useValue: { preview } }] });
		// The icons need the theme's icon registry; they are not what this spec is about.
		TestBed.overrideComponent(LinkCardsComponent, { set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA] } });
	});

	function render(body: string) {
		const fixture = TestBed.createComponent(LinkCardsComponent);
		fixture.componentRef.setInput('body', body);
		fixture.detectChanges();
		return fixture;
	}

	it('shows the site and the path of a link until the platform has a preview, then its text', () => {
		const fixture = render('See https://www.example.com/posts/1 and `https://code.example.com/` too');
		const card = (): HTMLElement => fixture.nativeElement.querySelector('[data-test="link-card"]');
		expect(fixture.nativeElement.querySelectorAll('[data-test="link-card"]')).toHaveLength(1);
		expect(card().textContent).toContain('example.com');
		expect(card().textContent).toContain('/posts/1');
		expect(preview).toHaveBeenCalledWith('https://www.example.com/posts/1');

		previews.get('https://www.example.com/posts/1')!.set({ siteName: 'Example', title: 'Post one', description: 'What it says' });
		fixture.detectChanges();
		expect(card().classList).toContain('rich');
		expect(card().querySelector('[data-test="link-preview-title"]')?.textContent).toBe('Post one');
		expect(card().querySelector('[data-test="link-preview-description"]')?.textContent).toBe('What it says');
		expect(card().textContent).toContain('Example');
		expect(card().getAttribute('href')).toBe('https://www.example.com/posts/1');
		expect(card().getAttribute('rel')).toBe('noopener noreferrer nofollow');
		// Text only: nothing is loaded from the linked site.
		expect(fixture.nativeElement.querySelector('img')).toBeNull();
	});

	it('shows the picture the platform served, from its blob URL only', () => {
		const fixture = render('https://www.example.com/pic');
		previews.get('https://www.example.com/pic')!.set({ siteName: null, title: 'With a picture', description: null, imageUrl: 'blob:picture', imageAlt: 'A cover' });
		fixture.detectChanges();
		const image = fixture.nativeElement.querySelector('[data-test="link-preview-image"]') as HTMLImageElement;
		expect(image.getAttribute('src')).toBe('blob:picture');
		expect(image.getAttribute('alt')).toBe('A cover');
	});

	it('renders a page title as text, never as markup', () => {
		const fixture = render('https://www.example.com/x');
		previews.get('https://www.example.com/x')!.set({ siteName: null, title: '<b>bold</b><img src=x>', description: null });
		fixture.detectChanges();
		const title = fixture.nativeElement.querySelector('[data-test="link-preview-title"]') as HTMLElement;
		expect(title.textContent).toBe('<b>bold</b><img src=x>');
		expect(title.querySelector('b, img')).toBeNull();
	});
});
