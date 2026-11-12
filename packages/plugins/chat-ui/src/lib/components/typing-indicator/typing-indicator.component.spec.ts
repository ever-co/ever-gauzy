// The ui-core barrel boots half the app (and needs packages this spec does not): what the live service names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ RealtimeSocketService: class RealtimeSocketService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CHAT_EVENT_NAMES } from '@gauzy/contracts';
import { ChatHint, ChatTypingSignal } from '../../services/chat-live';
import { ChatLiveService } from '../../services/chat-live.service';
import { TypingIndicatorComponent } from './typing-indicator.component';

const person = (userId: string, name: string) => ({ employeeId: `e-${userId}`, userId, name, imageUrl: null });
const PEOPLE = {
	byEmployee: new Map(),
	byUser: new Map([
		['u-anna', person('u-anna', 'Anna')],
		['u-ben', person('u-ben', 'Ben')],
		['me', person('me', 'Me')]
	]),
	list: []
};

describe('TypingIndicatorComponent', () => {
	let fixture: ComponentFixture<TypingIndicatorComponent>;
	let typing$: Subject<ChatTypingSignal>;
	let hints$: Subject<ChatHint>;

	beforeEach(async () => {
		jest.useFakeTimers({ now: new Date('2026-11-12T10:00:00Z') });
		typing$ = new Subject();
		hints$ = new Subject();
		await TestBed.configureTestingModule({
			imports: [TypingIndicatorComponent],
			providers: [{ provide: ChatLiveService, useValue: { typing$, hints$ } }]
		}).compileComponents();
		const translate = TestBed.inject(TranslateService);
		translate.setTranslation('en', {
			CHAT: { TYPING: { ONE: '{{name}} is typing…', TWO: '{{first}} and {{second}} are typing…', MANY: 'Several people are typing…' } }
		});
		translate.use('en');
		fixture = TestBed.createComponent(TypingIndicatorComponent);
		fixture.componentRef.setInput('conversationId', 'c1');
		fixture.componentRef.setInput('people', PEOPLE);
		fixture.componentRef.setInput('meUserId', 'me');
		fixture.detectChanges();
	});

	afterEach(() => {
		fixture.destroy();
		jest.useRealTimers();
	});

	const line = (): string => (fixture.nativeElement.querySelector('[data-test="typing-indicator"]')?.textContent ?? '').trim();
	const signal = (userId: string, expiresInMs = 6000, threadRootId: string | null = null): ChatTypingSignal => ({
		conversationId: 'c1',
		threadRootId,
		userId,
		employeeId: null,
		expiresAt: Date.now() + expiresInMs
	});

	it('says who is typing here, never me, and nothing elsewhere', () => {
		expect(line()).toBe('');
		typing$.next(signal('me'));
		typing$.next(signal('u-anna', 6000, 'r1'));
		fixture.detectChanges();
		expect(line()).toBe('');
		typing$.next(signal('u-anna'));
		fixture.detectChanges();
		expect(line()).toBe('Anna is typing…');
		typing$.next(signal('u-ben'));
		fixture.detectChanges();
		expect(line()).toBe('Anna and Ben are typing…');
	});

	it('lets a signal go once its time is past, unless it is told again', () => {
		typing$.next(signal('u-anna', 3000));
		fixture.detectChanges();
		jest.advanceTimersByTime(2000);
		typing$.next(signal('u-anna', 3000));
		jest.advanceTimersByTime(2000);
		fixture.detectChanges();
		expect(line()).toBe('Anna is typing…');
		jest.advanceTimersByTime(2000);
		fixture.detectChanges();
		expect(line()).toBe('');
	});

	it("ends a person's typing when their message arrives here", () => {
		typing$.next(signal('u-anna'));
		fixture.detectChanges();
		hints$.next({ eventId: 'e1', name: CHAT_EVENT_NAMES.MESSAGE_CREATED, conversationId: 'c1', messageId: 'm1', threadRootId: null, change: null, authorUserId: 'u-anna' });
		fixture.detectChanges();
		expect(line()).toBe('');
	});

	it('is a polite live region, so assistive technology reads it without interrupting', () => {
		expect(fixture.nativeElement.querySelector('[data-test="typing-indicator"]')?.getAttribute('aria-live')).toBe('polite');
	});
});
