// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable } from 'rxjs';
import { ChatLinkPreview } from '../../chat-link-previews';
import { ChatLinkPreviewService } from '../../services/chat-link-previews.service';
import { LinkCardsComponent } from './link-cards.component';

describe('LinkCardsComponent', () => {
	let fixture: ComponentFixture<LinkCardsComponent>;
	let answers: Map<string, BehaviorSubject<ChatLinkPreview | null>>;
	let preview: jest.Mock;

	beforeEach(async () => {
		answers = new Map();
		preview = jest.fn((url: string): Observable<ChatLinkPreview | null> => {
			if (!answers.has(url)) answers.set(url, new BehaviorSubject<ChatLinkPreview | null>(null));
			return answers.get(url)!.asObservable();
		});
		await TestBed.configureTestingModule({
			imports: [LinkCardsComponent],
			providers: [{ provide: ChatLinkPreviewService, useValue: { preview } }]
		}).compileComponents();
		fixture = TestBed.createComponent(LinkCardsComponent);
		fixture.componentRef.setInput('body', 'See https://example.com/post and https://example.org/');
		fixture.detectChanges();
	});

	const cards = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-test="link-card"]'));

	it('asks the platform for each link and shows the link-only card until a preview is ready', () => {
		expect(preview.mock.calls.map((call) => call[0])).toEqual(['https://example.com/post', 'https://example.org/']);
		expect(cards()).toHaveLength(2);
		expect(cards()[0].dataset['preview']).toBeUndefined();
		expect(cards()[0].textContent).toContain('example.com');
	});

	it('shows a ready preview: site, title, description as text, the picture at its own aspect ratio, lazy and without referrer', () => {
		answers.get('https://example.com/post')!.next({
			url: 'https://example.com/post',
			status: 'ready',
			siteName: 'Example',
			title: '<b>Not bold</b>',
			description: 'A <script>x</script> description',
			image: 'https://cdn.example.com/p.png',
			imageAlt: 'A picture',
			imageWidth: 1200,
			imageHeight: 630,
			icon: 'https://example.com/favicon.png'
		});
		fixture.detectChanges();
		const card = cards()[0];
		expect(card.dataset['preview']).toBe('ready');
		const title = card.querySelector('[data-test="link-preview-title"]') as HTMLElement;
		expect(title.textContent).toBe('<b>Not bold</b>');
		expect(title.querySelector('b')).toBeNull();
		expect(card.querySelector('script')).toBeNull();
		expect(card.textContent).toContain('Example');
		const image = card.querySelector('[data-test="link-preview-image"]') as HTMLImageElement;
		expect(image.getAttribute('src')).toBe('https://cdn.example.com/p.png');
		expect(image.getAttribute('alt')).toBe('A picture');
		expect(image.getAttribute('width')).toBe('1200');
		expect(image.getAttribute('height')).toBe('630');
		expect(image.getAttribute('loading')).toBe('lazy');
		expect(image.getAttribute('referrerpolicy')).toBe('no-referrer');
		expect(image.style.aspectRatio).toContain('1200');
		const icon = card.querySelector('.icon') as HTMLImageElement;
		expect(icon.getAttribute('referrerpolicy')).toBe('no-referrer');
		// The other link has no preview yet: still its link-only card.
		expect(cards()[1].dataset['preview']).toBeUndefined();
	});
});
