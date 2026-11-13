import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { defer, NEVER, Observable, of, Subject, throwError } from 'rxjs';
import { ChatAppBlockTypeEnum, ChatInteractionStatusEnum, ChatMessageKindEnum, IChatInteraction, IChatInteractionResult, IChatMessageWithRelations } from '@gauzy/contracts';
import { APP_INTERACTION_POLL_MAX, APP_INTERACTION_POLL_MS, APP_INTERACTION_RETRY_DELAYS_MS, APP_INTERACTION_TIMEOUT_MS } from '../../chat-app-blocks';
import { ChatWebhooksService } from '../../services/chat-webhooks.service';
import { AppBlocksComponent } from './app-blocks.component';

function appMessage(extra: Partial<IChatMessageWithRelations> = {}): IChatMessageWithRelations {
	return {
		id: 'm1',
		conversationId: 'c1',
		kind: ChatMessageKindEnum.APP,
		body: 'CPU high on api-1',
		appName: 'Monitor',
		mentionsChannel: false,
		mentionsHere: false,
		alsoInConversation: false,
		replyCount: 0,
		blocks: [
			{ type: ChatAppBlockTypeEnum.HEADER, text: 'CPU high <b>now</b>' },
			{ type: ChatAppBlockTypeEnum.SECTION, text: 'api-1 at 97%', fields: ['Env\nprod', 'Since 10:02'] },
			{ type: ChatAppBlockTypeEnum.DIVIDER },
			{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['monitor 7', 'eu-west'] },
			{
				type: ChatAppBlockTypeEnum.ACTIONS,
				blockId: 'alert-7',
				elements: [
					{ actionId: 'ack', text: 'Acknowledge', style: 'primary' },
					{ actionId: 'open', text: 'Open', url: 'https://monitor.example.com/7' },
					{ actionId: 'bad', text: 'Bad link', url: 'javascript:alert(1)' }
				]
			}
		],
		...extra
	} as IChatMessageWithRelations;
}

/** A version-4 UUID: the idempotency key a click carries. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const interaction = (status: ChatInteractionStatusEnum, extra: Partial<IChatInteraction> = {}): IChatInteraction => ({
	interactionId: 'i-1',
	messageId: 'm1',
	conversationId: 'c1',
	actionId: 'ack',
	status,
	attempts: 1,
	replyApplied: false,
	...extra
});

describe('AppBlocksComponent', () => {
	let fixture: ComponentFixture<AppBlocksComponent>;
	let api: { interact: jest.Mock; interaction: jest.Mock; message: jest.Mock };
	const element = () => fixture.nativeElement as HTMLElement;
	const button = (actionId: string) => element().querySelector<HTMLButtonElement>(`[data-test="app-button-${actionId}"]`) as HTMLButtonElement;

	async function render(message = appMessage(), readOnly = false): Promise<void> {
		api = { interact: jest.fn(), interaction: jest.fn(), message: jest.fn() };
		await TestBed.configureTestingModule({ imports: [AppBlocksComponent], providers: [{ provide: ChatWebhooksService, useValue: api }] }).compileComponents();
		fixture = TestBed.createComponent(AppBlocksComponent);
		fixture.componentRef.setInput('message', message);
		fixture.componentRef.setInput('readOnly', readOnly);
		fixture.detectChanges();
	}

	it('renders the title, fields side by side, divider, context and buttons as plain text', async () => {
		await render();
		expect(element().querySelector('[data-test="app-header"]')?.textContent?.trim()).toBe('CPU high <b>now</b>');
		expect(element().querySelector('b')).toBeNull();
		expect(element().querySelectorAll('[data-test="app-fields"] .app-field')).toHaveLength(2);
		expect(element().querySelector('hr')).not.toBeNull();
		expect(element().querySelector('.app-context')?.textContent?.trim()).toBe('monitor 7 · eu-west');
		const link = element().querySelector<HTMLAnchorElement>('a.app-button');
		expect(link?.getAttribute('href')).toBe('https://monitor.example.com/7');
		expect(link?.getAttribute('rel')).toContain('noopener');
		// A link that is not https is not a link: it shows as a (callback) button.
		expect(element().querySelectorAll('a.app-button')).toHaveLength(1);
		expect(button('bad')).not.toBeNull();
	});

	it('clicks through the interaction route, shows done, and hands up the replaced message', async () => {
		await render();
		const replaced = appMessage({ body: 'Acknowledged by Ana', blocks: [] });
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.DELIVERED, { replyApplied: true }), message: replaced, events: [] }));
		const emitted: IChatMessageWithRelations[] = [];
		fixture.componentInstance.replaced.subscribe((message) => emitted.push(message));
		button('ack').click();
		fixture.detectChanges();
		expect(api.interact).toHaveBeenCalledWith('m1', 'ack', 'alert-7', expect.stringMatching(UUID));
		expect(emitted).toEqual([replaced]);
		expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
	});

	it('stays pending while the callback is retried, asking again until it settles', async () => {
		await render();
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.RETRYING))).mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.FAILED)));
		fakeAsync(() => {
			button('ack').click();
			fixture.detectChanges();
			expect(button('ack').disabled).toBe(true);
			tick(APP_INTERACTION_POLL_MS);
			fixture.detectChanges();
			expect(button('ack').disabled).toBe(true);
			tick(APP_INTERACTION_POLL_MS);
			fixture.detectChanges();
			expect(api.interaction).toHaveBeenCalledTimes(2);
			expect(button('ack').disabled).toBe(false);
			expect(element().querySelector('[data-test="app-failure"]')).not.toBeNull();
			tick(APP_INTERACTION_POLL_MS * 3);
			expect(api.interaction).toHaveBeenCalledTimes(2);
		})();
	});

	it('reads the message again when a retried callback was answered with a reply, and hands it up', async () => {
		await render();
		const replaced = appMessage({ body: 'Acknowledged by Ana', blocks: [] });
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.DELIVERED, { replyApplied: true })));
		api.message.mockReturnValue(of(replaced));
		const emitted: IChatMessageWithRelations[] = [];
		fixture.componentInstance.replaced.subscribe((message) => emitted.push(message));
		fakeAsync(() => {
			button('ack').click();
			fixture.detectChanges();
			tick(APP_INTERACTION_POLL_MS);
			fixture.detectChanges();
			expect(api.message).toHaveBeenCalledWith('c1', 'm1');
			expect(emitted).toEqual([replaced]);
			expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
		})();
	});

	it('asks once more about a delivery without its reply, and reads nothing when none came', async () => {
		await render();
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValue(of(interaction(ChatInteractionStatusEnum.DELIVERED)));
		fakeAsync(() => {
			button('ack').click();
			tick(APP_INTERACTION_POLL_MS * 4);
			fixture.detectChanges();
			expect(api.interaction).toHaveBeenCalledTimes(2);
			expect(api.message).not.toHaveBeenCalled();
			expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
		})();
	});

	it('reads the reply the API applied just after it wrote the delivery', async () => {
		await render();
		const replaced = appMessage({ body: 'Acknowledged by Ana', blocks: [] });
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.DELIVERED))).mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.DELIVERED, { replyApplied: true })));
		api.message.mockReturnValue(of(replaced));
		const emitted: IChatMessageWithRelations[] = [];
		fixture.componentInstance.replaced.subscribe((message) => emitted.push(message));
		fakeAsync(() => {
			button('ack').click();
			tick(APP_INTERACTION_POLL_MS * 2);
			expect(api.message).toHaveBeenCalledTimes(1);
			expect(emitted).toEqual([replaced]);
		})();
	});

	it('keeps the button pending, and so disabled, while it asks once more after a delivery', async () => {
		await render();
		const second = new Subject<IChatInteraction>();
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.DELIVERED))).mockReturnValueOnce(second);
		fakeAsync(() => {
			button('ack').click();
			tick(APP_INTERACTION_POLL_MS * 2);
			fixture.detectChanges();
			expect(button('ack').disabled).toBe(true);
			button('ack').click();
			expect(api.interact).toHaveBeenCalledTimes(1);
			second.next(interaction(ChatInteractionStatusEnum.DELIVERED));
			second.complete();
			fixture.detectChanges();
			expect(button('ack').disabled).toBe(false);
			expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
		})();
	});

	it('asks again after a failed ask instead of calling the click failed', async () => {
		await render();
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValueOnce(throwError(() => ({ status: 503 }))).mockReturnValueOnce(of(interaction(ChatInteractionStatusEnum.DELIVERED, { replyApplied: false }))).mockReturnValue(of(interaction(ChatInteractionStatusEnum.DELIVERED)));
		fakeAsync(() => {
			button('ack').click();
			tick(APP_INTERACTION_POLL_MS);
			fixture.detectChanges();
			expect(button('ack').disabled).toBe(true);
			expect(element().querySelector('[data-test="app-failure"]')).toBeNull();
			tick(APP_INTERACTION_POLL_MS * 2);
			fixture.detectChanges();
			expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
		})();
	});

	it('waits for a slow answer instead of asking again over it', async () => {
		await render();
		const slow = new Subject<IChatInteraction>();
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValueOnce(slow).mockReturnValue(of(interaction(ChatInteractionStatusEnum.FAILED)));
		fakeAsync(() => {
			button('ack').click();
			tick(APP_INTERACTION_POLL_MS * 3);
			// One ask, still on its way: the next ticks were skipped, not used to cancel it.
			expect(api.interaction).toHaveBeenCalledTimes(1);
			slow.next(interaction(ChatInteractionStatusEnum.FAILED));
			slow.complete();
			fixture.detectChanges();
			expect(element().querySelector('[data-test="app-failure"]')?.textContent).toContain('CHAT.APP.CALLBACK_FAILED');
		})();
	});

	it('lets the button click again, and says so, when the callback is still retried after the page stops asking', async () => {
		await render();
		api.interact.mockReturnValue(of<IChatInteractionResult>({ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }));
		api.interaction.mockReturnValue(of(interaction(ChatInteractionStatusEnum.RETRYING)));
		fakeAsync(() => {
			button('ack').click();
			fixture.detectChanges();
			tick(APP_INTERACTION_POLL_MS * APP_INTERACTION_POLL_MAX);
			fixture.detectChanges();
			expect(api.interaction).toHaveBeenCalledTimes(APP_INTERACTION_POLL_MAX);
			expect(button('ack').disabled).toBe(false);
			expect(button('ack').getAttribute('aria-busy')).toBe('false');
			expect(element().querySelector('[data-test="app-failure"]')?.textContent).toContain('CHAT.APP.NO_ANSWER_YET');
			tick(APP_INTERACTION_POLL_MS * 3);
			expect(api.interaction).toHaveBeenCalledTimes(APP_INTERACTION_POLL_MAX);
		})();
	});

	it('shows why a click failed', async () => {
		await render();
		api.interact.mockReturnValue(throwError(() => ({ status: 409 })));
		button('ack').click();
		fixture.detectChanges();
		expect(element().querySelector('[data-test="app-failure"]')?.textContent).toContain('CHAT.APP.NO_INTERACTIONS');
	});

	it('leaves read-only buttons inert', async () => {
		await render(appMessage(), true);
		expect(button('ack').disabled).toBe(true);
		button('ack').click();
		expect(api.interact).not.toHaveBeenCalled();
	});

	describe('idempotency key', () => {
		const delivered = (): IChatInteractionResult => ({ interaction: interaction(ChatInteractionStatusEnum.DELIVERED), events: [] });

		/**
		 * The platform as a request sees it: each subscription is one request (a retry subscribes again), answered in turn
		 * by `answers` (an error status, `'hang'` for a request that never answers, or the result). The key every request
		 * carried is recorded.
		 */
		function serve(answers: Array<number | 'hang' | IChatInteractionResult>): string[] {
			const keys: string[] = [];
			api.interact.mockImplementation((_messageId: string, _actionId: string, _blockId: string | null, key: string): Observable<IChatInteractionResult> =>
				defer(() => {
					keys.push(key);
					const next = answers.shift() ?? 0;
					if (next === 'hang') return NEVER;
					return typeof next === 'number' ? throwError(() => ({ status: next })) : of(next);
				})
			);
			return keys;
		}

		it('gives each click a key of its own: a UUID, a new one for the next click', async () => {
			await render();
			const keys = serve([delivered(), delivered()]);
			button('ack').click();
			fixture.detectChanges();
			button('ack').click();
			expect(keys).toHaveLength(2);
			expect(keys[0]).toMatch(UUID);
			expect(keys[1]).toMatch(UUID);
			expect(keys[0]).not.toBe(keys[1]);
		});

		it('sends a click that got no answer again with the same key, and settles on the answer', async () => {
			await render();
			const keys = serve([0, 504, delivered()]);
			fakeAsync(() => {
				button('ack').click();
				fixture.detectChanges();
				expect(button('ack').disabled).toBe(true);
				tick(APP_INTERACTION_RETRY_DELAYS_MS[0]);
				tick(APP_INTERACTION_RETRY_DELAYS_MS[1]);
				fixture.detectChanges();
				expect(keys).toHaveLength(3);
				expect(new Set(keys).size).toBe(1);
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
				expect(element().querySelector('[data-test="app-failure"]')).toBeNull();
			})();
		});

		it('says a click that never got an answer failed, and sends its key again on the next click of the button', async () => {
			await render();
			const keys = serve([0, 0, 0, delivered(), delivered()]);
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0));
				fixture.detectChanges();
				expect(keys).toHaveLength(1 + APP_INTERACTION_RETRY_DELAYS_MS.length);
				expect(element().querySelector('[data-test="app-failure"]')?.textContent).toContain('CHAT.APP.CLICK_FAILED');
				// The API may have taken it: the next click is the same click.
				button('ack').click();
				fixture.detectChanges();
				expect(new Set(keys).size).toBe(1);
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
				// Answered: the click after it is a new one.
				button('ack').click();
				expect(keys[keys.length - 1]).not.toBe(keys[0]);
			})();
		});

		it('does not send an answered refusal again, and gives the next click a new key', async () => {
			await render();
			const keys = serve([404, delivered()]);
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0));
				fixture.detectChanges();
				expect(keys).toHaveLength(1);
				expect(element().querySelector('[data-test="app-failure"]')?.textContent).toContain('CHAT.APP.GONE');
				button('ack').click();
				expect(keys).toHaveLength(2);
				expect(keys[1]).not.toBe(keys[0]);
			})();
		});

		it('sends a click again, with its key, when its request hangs past the deadline', async () => {
			await render();
			const keys = serve(['hang', delivered()]);
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_TIMEOUT_MS - 1);
				expect(keys).toHaveLength(1);
				tick(1 + APP_INTERACTION_RETRY_DELAYS_MS[0]);
				fixture.detectChanges();
				expect(keys).toHaveLength(2);
				expect(keys[1]).toBe(keys[0]);
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
			})();
		});

		it('does not send a click again after a server error, but keeps its key for the next click (the app may have been called)', async () => {
			await render();
			const keys = serve([500, delivered()]);
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0));
				fixture.detectChanges();
				expect(keys).toHaveLength(1);
				expect(element().querySelector('[data-test="app-failure"]')?.textContent).toContain('CHAT.APP.CLICK_FAILED');
				button('ack').click();
				expect(keys).toEqual([keys[0], keys[0]]);
			})();
		});

		it('keeps a repeat answered as delivered without its reply pending, and reads the reply the first request applied', async () => {
			await render();
			const replaced = appMessage({ body: 'Acknowledged by Ana', blocks: [] });
			serve([{ interaction: interaction(ChatInteractionStatusEnum.DELIVERED), events: [], replayed: true }]);
			api.interaction.mockReturnValue(of(interaction(ChatInteractionStatusEnum.DELIVERED, { replyApplied: true })));
			api.message.mockReturnValue(of(replaced));
			const emitted: IChatMessageWithRelations[] = [];
			fixture.componentInstance.replaced.subscribe((message) => emitted.push(message));
			fakeAsync(() => {
				button('ack').click();
				fixture.detectChanges();
				expect(button('ack').disabled).toBe(true);
				tick(APP_INTERACTION_POLL_MS);
				fixture.detectChanges();
				expect(api.message).toHaveBeenCalledWith('c1', 'm1');
				expect(emitted).toEqual([replaced]);
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
			})();
		});

		it('gives up on an ask still open after the deadline, and asks again', async () => {
			await render();
			serve([{ interaction: interaction(ChatInteractionStatusEnum.RETRYING), events: [] }]);
			api.interaction.mockReturnValueOnce(NEVER).mockReturnValue(of(interaction(ChatInteractionStatusEnum.DELIVERED, { replyApplied: true })));
			api.message.mockReturnValue(of(appMessage()));
			fakeAsync(() => {
				button('ack').click();
				// The first ask hangs: no second one while it is open.
				tick(APP_INTERACTION_POLL_MS + APP_INTERACTION_TIMEOUT_MS - 1);
				expect(api.interaction).toHaveBeenCalledTimes(1);
				tick(APP_INTERACTION_POLL_MS + 1);
				fixture.detectChanges();
				expect(api.interaction).toHaveBeenCalledTimes(2);
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
			})();
		});

		it('keeps a delivery the repeat already reported when the one more ask finds the click gone', async () => {
			await render();
			serve([{ interaction: interaction(ChatInteractionStatusEnum.DELIVERED), events: [], replayed: true }]);
			api.interaction.mockReturnValue(throwError(() => ({ status: 404 })));
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_POLL_MS);
				fixture.detectChanges();
				expect(api.interaction).toHaveBeenCalledTimes(1);
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
				expect(element().querySelector('[data-test="app-failure"]')).toBeNull();
			})();
		});

		it('keeps a delivery the repeat already reported when every ask fails', async () => {
			await render();
			serve([{ interaction: interaction(ChatInteractionStatusEnum.DELIVERED), events: [], replayed: true }]);
			api.interaction.mockReturnValue(throwError(() => ({ status: 503 })));
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_POLL_MS * APP_INTERACTION_POLL_MAX);
				fixture.detectChanges();
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
				expect(element().querySelector('[data-test="app-failure"]')).toBeNull();
			})();
		});

		it('asks only once more after a repeat reported the delivery, and ends done without a reply', async () => {
			await render();
			serve([{ interaction: interaction(ChatInteractionStatusEnum.DELIVERED), events: [], replayed: true }]);
			api.interaction.mockReturnValue(of(interaction(ChatInteractionStatusEnum.DELIVERED)));
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_POLL_MS * 3);
				fixture.detectChanges();
				expect(api.interaction).toHaveBeenCalledTimes(1);
				expect(api.message).not.toHaveBeenCalled();
				expect(button('ack').querySelector('nb-icon')?.getAttribute('icon')).toBe('checkmark-outline');
			})();
		});

		it('does not ask again about a first answer delivered without a reply (the app sent none)', async () => {
			await render();
			serve([delivered()]);
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_POLL_MS * 3);
				expect(api.interaction).not.toHaveBeenCalled();
			})();
		});

		it('keeps the keys of two buttons apart', async () => {
			await render(appMessage({ blocks: [{ type: ChatAppBlockTypeEnum.ACTIONS, blockId: 'b', elements: [{ actionId: 'ack', text: 'Acknowledge' }, { actionId: 'snooze', text: 'Snooze' }] }] }));
			const keys = serve([0, 0, 0, delivered()]);
			fakeAsync(() => {
				button('ack').click();
				tick(APP_INTERACTION_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0));
				fixture.detectChanges();
				button('snooze').click();
				expect(keys[keys.length - 1]).not.toBe(keys[0]);
			})();
		});
	});
});
