import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ChatAppBlockTypeEnum, ChatInteractionStatusEnum, ChatMessageKindEnum, IChatInteraction, IChatInteractionResult, IChatMessageWithRelations } from '@gauzy/contracts';
import { APP_INTERACTION_POLL_MS } from '../../chat-app-blocks';
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
	let api: { interact: jest.Mock; interaction: jest.Mock };
	const element = () => fixture.nativeElement as HTMLElement;
	const button = (actionId: string) => element().querySelector<HTMLButtonElement>(`[data-test="app-button-${actionId}"]`) as HTMLButtonElement;

	async function render(message = appMessage(), readOnly = false): Promise<void> {
		api = { interact: jest.fn(), interaction: jest.fn() };
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
		expect(api.interact).toHaveBeenCalledWith('m1', 'ack', 'alert-7');
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
});
