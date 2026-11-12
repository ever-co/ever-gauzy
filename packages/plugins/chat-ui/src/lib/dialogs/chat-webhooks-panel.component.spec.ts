// cspell:ignore gzcws gzcwh
// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { IChatWebhook } from '@gauzy/contracts';
import { ChatWebhooksService } from '../services/chat-webhooks.service';
import { ChatWebhooksPanelComponent, webhookChanges } from './chat-webhooks-panel.component';

const ANNA = { employeeId: 'e-anna', userId: 'u-anna', name: 'Anna', imageUrl: null };
const PEOPLE = { byEmployee: new Map([[ANNA.employeeId, ANNA]]), byUser: new Map(), list: [ANNA] };

function webhook(extra: Partial<IChatWebhook> = {}): IChatWebhook {
	return {
		id: 'w1',
		conversationId: 'c1',
		name: 'Deploys',
		iconUrl: null,
		interactionUrl: null,
		tokenHint: 'abcd',
		hasSigningSecret: true,
		canBroadcast: false,
		createdByEmployeeId: ANNA.employeeId,
		createdAt: new Date('2026-11-10T10:00:00Z'),
		lastUsedAt: null,
		acceptedCount: 3,
		rejectedCount: 1,
		rateLimitedCount: 0,
		callbackFailureCount: 0,
		...extra
	} as IChatWebhook;
}

describe('webhookChanges', () => {
	it('names only what changed, an emptied URL as null', () => {
		const current = webhook({ iconUrl: 'https://cdn.example.com/a.png', interactionUrl: 'https://hooks.example.com/x' });
		expect(webhookChanges(current, { name: 'Deploys', iconUrl: 'https://cdn.example.com/a.png', interactionUrl: 'https://hooks.example.com/x', canBroadcast: false })).toEqual({});
		expect(webhookChanges(current, { name: ' Releases ', iconUrl: '', interactionUrl: 'https://hooks.example.com/x', canBroadcast: true })).toEqual({
			name: 'Releases',
			iconUrl: null,
			canBroadcast: true
		});
	});
});

describe('ChatWebhooksPanelComponent', () => {
	let fixture: ComponentFixture<ChatWebhooksPanelComponent>;
	let api: Record<string, jest.Mock>;
	const element = () => fixture.nativeElement as HTMLElement;
	// The panel's members are protected: the spec reaches them as the template does.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const panel = () => fixture.componentInstance as unknown as Record<string, any>;

	async function open(initial: IChatWebhook[] | null = [webhook()]): Promise<void> {
		api = {
			list: jest.fn(() => of([webhook()])),
			create: jest.fn((_id, input) => of({ webhook: webhook({ id: 'w2', ...input }), url: 'https://api.example.com/api/chat/hooks/gzcwh_x', signingSecret: 'gzcws_y' })),
			update: jest.fn((id, input) => of({ webhook: webhook({ id, ...input }) })),
			rotateSecret: jest.fn((id) => of({ webhook: webhook({ id }), signingSecret: 'gzcws_new' })),
			revoke: jest.fn((id) => of({ webhook: webhook({ id, revokedAt: new Date() }) }))
		};
		await TestBed.configureTestingModule({ imports: [ChatWebhooksPanelComponent], providers: [{ provide: ChatWebhooksService, useValue: api }] }).compileComponents();
		fixture = TestBed.createComponent(ChatWebhooksPanelComponent);
		fixture.componentRef.setInput('conversationId', 'c1');
		fixture.componentRef.setInput('people', PEOPLE);
		fixture.componentRef.setInput('initial', initial);
		fixture.detectChanges();
	}

	it('lists the webhooks it was handed, with creator and counters, without reading them again', async () => {
		await open();
		expect(api['list']).not.toHaveBeenCalled();
		const row = element().querySelector('[data-test="webhook-w1"]') as HTMLElement;
		expect(row.textContent).toContain('Deploys');
		expect(panel()['creatorOf'](webhook())).toBe('Anna');
	});

	it('reads the list itself when nothing was handed', async () => {
		await open(null);
		expect(api['list']).toHaveBeenCalledWith('c1');
	});

	it('creates a webhook and shows its URL and signing secret once', async () => {
		await open();
		panel()['startCreate']();
		panel()['patch']({ name: ' Monitor ', interactionUrl: 'https://hooks.example.com/x', canBroadcast: true });
		panel()['create']();
		fixture.detectChanges();
		expect(api['create']).toHaveBeenCalledWith('c1', { name: 'Monitor', iconUrl: null, interactionUrl: 'https://hooks.example.com/x', canBroadcast: true });
		expect((element().querySelector('[data-test="webhook-url"]') as HTMLInputElement).value).toBe('https://api.example.com/api/chat/hooks/gzcwh_x');
		expect((element().querySelector('[data-test="webhook-secret"]') as HTMLInputElement).value).toBe('gzcws_y');
		(element().querySelector('[data-test="secrets-done"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(element().querySelector('[data-test="webhook-secrets"]')).toBeNull();
		expect(panel()['webhooks']().map((item: IChatWebhook) => item.id)).toEqual(['w2', 'w1']);
	});

	it('revokes and rotates only after a confirmation', async () => {
		await open();
		const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
		panel()['revoke'](webhook());
		expect(api['revoke']).not.toHaveBeenCalled();
		panel()['revoke'](webhook());
		expect(api['revoke']).toHaveBeenCalledWith('w1');
		expect(panel()['webhooks']()[0].revokedAt).toBeTruthy();
		panel()['rotate'](webhook());
		fixture.detectChanges();
		expect((element().querySelector('[data-test="webhook-secret"]') as HTMLInputElement).value).toBe('gzcws_new');
		confirm.mockRestore();
	});

	it('holds every write that may make a secret while one is on screen, until it is dismissed', async () => {
		await open();
		panel()['startCreate']();
		panel()['patch']({ name: 'Monitor' });
		panel()['create']();
		fixture.detectChanges();
		expect(element().querySelector('[data-test="webhook-secrets"]')).not.toBeNull();
		expect((element().querySelector('[data-test="new-webhook"]') as HTMLButtonElement).disabled).toBe(true);
		expect((element().querySelector('[data-test="rotate-webhook-w1"]') as HTMLButtonElement).disabled).toBe(true);
		expect((element().querySelector('[data-test="edit-webhook-w1"]') as HTMLButtonElement).disabled).toBe(true);
		// Called anyway (a stale click): nothing is written, so the first secret is not replaced.
		const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
		panel()['rotate'](webhook());
		panel()['create']();
		expect(api['rotateSecret']).not.toHaveBeenCalled();
		expect(api['create']).toHaveBeenCalledTimes(1);
		(element().querySelector('[data-test="secrets-done"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect((element().querySelector('[data-test="rotate-webhook-w1"]') as HTMLButtonElement).disabled).toBe(false);
		panel()['rotate'](webhook());
		expect(api['rotateSecret']).toHaveBeenCalledWith('w1');
		confirm.mockRestore();
	});

	it('shows the API refusal', async () => {
		await open();
		api['update'].mockReturnValueOnce(throwError(() => ({ error: { message: 'The interaction URL must name a public host.' } })));
		panel()['startEdit'](webhook());
		panel()['patch']({ interactionUrl: 'https://10.0.0.1/x' });
		panel()['saveEdit'](webhook());
		fixture.detectChanges();
		expect(element().querySelector('[data-test="webhooks-error"]')?.textContent).toContain('public host');
	});
});
