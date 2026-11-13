import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChatUiService } from './chat-ui.service';

describe('ChatUiService.signalTyping', () => {
	let api: ChatUiService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		api = TestBed.inject(ChatUiService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	const typingOf = (conversationId: string) => (request: { url: string; method: string }) =>
		request.method === 'POST' && request.url.endsWith(`/chat/conversations/${conversationId}/typing`);

	it('tells the platform where the person types: the conversation, or one of its threads', () => {
		api.signalTyping('c1');
		const conversation = http.expectOne(typingOf('c1'));
		expect(conversation.request.body).toEqual({});
		conversation.flush({ sent: true, expiresInMs: 6000 });

		api.signalTyping('c1', 'r1');
		const thread = http.expectOne(typingOf('c1'));
		expect(thread.request.body).toEqual({ threadRootId: 'r1' });
		thread.flush({ sent: true, expiresInMs: 6000 });
	});

	it('stops asking in a place that refused, and keeps asking elsewhere', () => {
		api.signalTyping('c1');
		http.expectOne(typingOf('c1')).flush({ message: 'The requested record was not found' }, { status: 404, statusText: 'Not Found' });
		api.signalTyping('c1');
		http.expectNone(typingOf('c1'));
		// The same conversation's thread is another place.
		api.signalTyping('c1', 'r1');
		http.expectOne(typingOf('c1')).flush({ sent: true, expiresInMs: 6000 });
		api.signalTyping('c2');
		http.expectOne(typingOf('c2')).flush({ sent: true, expiresInMs: 6000 });
	});

	it('stops asking anywhere on a platform without the route', () => {
		api.signalTyping('c1');
		http.expectOne(typingOf('c1')).flush({ message: 'Cannot POST /api/chat/conversations/c1/typing' }, { status: 404, statusText: 'Not Found' });
		api.signalTyping('c2');
		api.signalTyping('c1', 'r1');
		http.expectNone(() => true);
	});

	it('asks again after a passing failure', () => {
		api.signalTyping('c1');
		http.expectOne(typingOf('c1')).flush({ message: 'Too many requests' }, { status: 429, statusText: 'Too Many Requests' });
		api.signalTyping('c1');
		http.expectOne(typingOf('c1')).flush({ sent: true, expiresInMs: 6000 });
	});
});
