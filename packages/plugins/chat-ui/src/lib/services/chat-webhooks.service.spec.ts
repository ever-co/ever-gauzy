import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChatInteractionStatusEnum, IChatInteractionResult } from '@gauzy/contracts';
import { ChatWebhooksService } from './chat-webhooks.service';

describe('ChatWebhooksService.interact', () => {
	let api: ChatWebhooksService;
	let http: HttpTestingController;
	const answer: IChatInteractionResult = {
		interaction: { interactionId: 'i-1', messageId: 'm1', conversationId: 'c1', actionId: 'ack', status: ChatInteractionStatusEnum.DELIVERED, attempts: 1, replyApplied: false },
		events: []
	};
	const interactionsOf = (messageId: string) => (request: { url: string; method: string }) => request.method === 'POST' && request.url.endsWith(`/chat/messages/${messageId}/interactions`);

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		api = TestBed.inject(ChatWebhooksService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('sends the click’s idempotency key in the Idempotency-Key header, and the button in the body', () => {
		api.interact('m1', 'ack', 'alert-7', 'key-1').subscribe();
		const request = http.expectOne(interactionsOf('m1'));
		expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
		expect(request.request.body).toEqual({ actionId: 'ack', blockId: 'alert-7' });
		request.flush(answer);
	});

	it('sends the same key again when the click is sent again', () => {
		const click = api.interact('m1', 'ack', null, 'key-1');
		click.subscribe({ error: () => undefined });
		http.expectOne(interactionsOf('m1')).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
		click.subscribe();
		const again = http.expectOne(interactionsOf('m1'));
		expect(again.request.headers.get('Idempotency-Key')).toBe('key-1');
		expect(again.request.body).toEqual({ actionId: 'ack' });
		again.flush(answer);
	});

	it('sends no header without a key (an older caller)', () => {
		api.interact('m1', 'ack').subscribe();
		const request = http.expectOne(interactionsOf('m1'));
		expect(request.request.headers.has('Idempotency-Key')).toBe(false);
		request.flush(answer);
	});
});
