// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NbDialogRef } from '@nebular/theme';
import { NEVER, of, Subject, throwError } from 'rxjs';
import {
	ChatConversationKindEnum,
	ChatMemberRoleEnum,
	ChatVisibilityEnum,
	IChatCategory,
	IChatConversationWithState,
	IChatMemberSummary,
	IChatWebhook,
	IChatWebhookWriteResult
} from '@gauzy/contracts';
import { ChatPerson } from '../chat-ui.helpers';
import { ChatUiService } from '../services/chat-ui.service';
import { ChatWebhooksService } from '../services/chat-webhooks.service';
import { CategoriesDialogComponent, ChannelSettingsContext, ChannelSettingsDialogComponent } from './chat-settings-dialogs.component';
import { ChatWebhooksPanelComponent } from './chat-webhooks-panel.component';
import { ChatPresenceService } from '../services/chat-presence.service';

const ME = 'e-me';
const ANNA = 'e-anna';
const BOB = 'e-bob';
const person = (employeeId: string, name: string): ChatPerson => ({ employeeId, userId: `u-${employeeId}`, name, imageUrl: null });
const people = [{ ...person(ME, 'Me'), position: 'Designer' }, person(ANNA, 'Anna'), person(BOB, 'Bob')];
const PEOPLE = { byEmployee: new Map(people.map((item) => [item.employeeId, item])), byUser: new Map(), list: people };

function channel(extra: Partial<IChatConversationWithState> = {}): IChatConversationWithState {
	return {
		id: 'c1',
		kind: ChatConversationKindEnum.CHANNEL,
		name: 'design',
		topic: 'Pixels',
		visibility: ChatVisibilityEnum.PUBLIC,
		categoryId: null,
		position: 0,
		isDefault: false,
		messageCount: 3,
		memberCount: 2,
		state: null,
		...extra
	} as IChatConversationWithState;
}

const members: IChatMemberSummary[] = [
	{ employeeId: ME, userId: 'u-me', role: ChatMemberRoleEnum.MANAGER },
	{ employeeId: ANNA, userId: 'u-anna', role: ChatMemberRoleEnum.MEMBER }
];

describe('ChannelSettingsDialogComponent', () => {
	let fixture: ComponentFixture<ChannelSettingsDialogComponent>;
	let api: Record<string, jest.Mock>;
	let close: jest.Mock;
	let backdrop: Subject<MouseEvent>;
	let webhooksApi: { list: jest.Mock; create: jest.Mock; update: jest.Mock };

	async function open(context: Partial<ChannelSettingsContext>, webhooks: 'off' | 'on' = 'off'): Promise<void> {
		// Where the API serves no webhooks, their list answers 404.
		webhooksApi = { list: jest.fn(() => (webhooks === 'on' ? of([]) : throwError(() => ({ status: 404 })))), create: jest.fn(), update: jest.fn() };
		backdrop = new Subject<MouseEvent>();
		// The API's member count, as the member changes leave it.
		let memberCount = members.length;
		api = {
			members: jest.fn(() => of(members)),
			updateConversation: jest.fn((_id, input) => of({ conversation: channel(input), events: [] })),
			addMembers: jest.fn((_id, ids: string[]) => {
				memberCount += ids.length;
				return of({ members: [...members, ...ids.map((employeeId) => ({ employeeId, userId: `u-${employeeId}`, role: ChatMemberRoleEnum.MEMBER }))], events: [] });
			}),
			removeMember: jest.fn(() => {
				memberCount -= 1;
				return of({ events: [] });
			}),
			getConversation: jest.fn(() => of(channel({ memberCount }))),
			notifyChanged: jest.fn()
		};
		close = jest.fn();
		await TestBed.configureTestingModule({
			imports: [ChannelSettingsDialogComponent],
			providers: [
				{ provide: ChatUiService, useValue: api },
				{ provide: ChatPresenceService, useValue: { presenceOf: () => 'offline', lastSeenOf: () => null, watch: () => NEVER, apply: () => undefined, applyList: () => undefined } },
				{ provide: ChatWebhooksService, useValue: webhooksApi },
				{ provide: NbDialogRef, useValue: { close, onBackdropClick: backdrop } }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(ChannelSettingsDialogComponent);
		fixture.componentInstance.context = { conversation: channel(), categories: [], people: PEOPLE, meEmployeeId: ME, canManage: true, ...context };
		fixture.detectChanges();
	}

	// The dialog's members are protected: the spec reaches them as the template does.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dialog = () => fixture.componentInstance as unknown as Record<string, any>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const panel = () => fixture.debugElement.query(By.directive(ChatWebhooksPanelComponent)).componentInstance as unknown as Record<string, any>;
	const tabTo = (tab: 'settings' | 'members' | 'integrations') => {
		(fixture.nativeElement.querySelector(`[data-test="tab-${tab}"]`) as HTMLButtonElement).click();
		fixture.detectChanges();
	};
	const webhook = (id: string, name: string): IChatWebhook => ({ id, conversationId: 'c1', name, canBroadcast: false }) as unknown as IChatWebhook;

	it('offers an Integrations tab to a channel manager where the API serves webhooks, and none where it answers 404', async () => {
		await open({}, 'on');
		expect(webhooksApi.list).toHaveBeenCalledWith('c1');
		const tab = fixture.nativeElement.querySelector('[data-test="tab-integrations"]') as HTMLButtonElement;
		expect(tab).not.toBeNull();
		tab.click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-panel"]')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="settings-members"]')).toBeNull();
	});

	it('keeps the Integrations tab while another tab shows, so a webhook made there is still listed on return', async () => {
		await open({}, 'on');
		webhooksApi.create.mockReturnValue(of({ webhook: webhook('w-1', 'CI'), url: 'https://api.example.com/api/chat/hooks/s', signingSecret: 'k' }));
		tabTo('integrations');
		panel().patch({ name: 'CI' });
		panel().create();
		tabTo('members');
		expect(fixture.nativeElement.querySelector('[data-test="settings-members"]')).not.toBeNull();
		expect((fixture.nativeElement.querySelector('ngx-chat-webhooks-panel') as HTMLElement).hidden).toBe(true);
		tabTo('integrations');
		expect(panel().webhooks().map((item: IChatWebhook) => item.name)).toEqual(['CI']);
		expect(webhooksApi.list).toHaveBeenCalledTimes(1);
	});

	it('waits for a webhook write before closing, and stays open on the secret it made', async () => {
		await open({}, 'on');
		const write = new Subject<IChatWebhookWriteResult>();
		webhooksApi.create.mockReturnValueOnce(write);
		tabTo('integrations');
		panel().patch({ name: 'CI' });
		panel().create();
		// Settings shows, and Close is asked for, while the write runs.
		tabTo('settings');
		dialog().close();
		expect(close).not.toHaveBeenCalled();
		write.next({ webhook: webhook('w-1', 'CI'), url: 'https://api.example.com/api/chat/hooks/s', signingSecret: 'k' });
		write.complete();
		fixture.detectChanges();
		// The secret shows once: the dialog stays open on it, its tab brought forward.
		expect(close).not.toHaveBeenCalled();
		expect(dialog().tab()).toBe('integrations');
		expect(fixture.nativeElement.querySelector('[data-test="webhook-secrets"]')).not.toBeNull();
		dialog().close();
		expect(close).toHaveBeenCalled();
	});

	it('saves the settings while a webhook write runs, and stays open on the secret it made', async () => {
		await open({}, 'on');
		const write = new Subject<IChatWebhookWriteResult>();
		webhooksApi.create.mockReturnValueOnce(write);
		tabTo('integrations');
		panel().patch({ name: 'CI' });
		panel().create();
		tabTo('settings');
		dialog().topic.set('Pixels and fonts');
		dialog().save();
		expect(api.updateConversation).toHaveBeenCalled();
		// Saved, but the webhook write is still under way: the dialog waits for it.
		expect(close).not.toHaveBeenCalled();
		write.next({ webhook: webhook('w-1', 'CI'), url: 'https://api.example.com/api/chat/hooks/s', signingSecret: 'k' });
		write.complete();
		fixture.detectChanges();
		expect(close).not.toHaveBeenCalled();
		expect(fixture.nativeElement.querySelector('[data-test="webhook-secrets"]')).not.toBeNull();
		// Closed after reading the secret: with the conversation as saved.
		dialog().close();
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', topic: 'Pixels and fonts' }));
	});

	it('stays open on a secret that came back before a Save running alongside it', async () => {
		await open({}, 'on');
		const write = new Subject<IChatWebhookWriteResult>();
		const saved = new Subject<{ conversation: IChatConversationWithState; events: never[] }>();
		webhooksApi.create.mockReturnValueOnce(write);
		api['updateConversation'].mockReturnValueOnce(saved);
		tabTo('integrations');
		panel().patch({ name: 'CI' });
		panel().create();
		tabTo('settings');
		dialog().topic.set('Pixels and fonts');
		dialog().save();
		// The webhook answers first, with its secret; then the settings.
		write.next({ webhook: webhook('w-1', 'CI'), url: 'https://api.example.com/api/chat/hooks/s', signingSecret: 'k' });
		write.complete();
		saved.next({ conversation: channel({ topic: 'Pixels and fonts' }), events: [] });
		saved.complete();
		fixture.detectChanges();
		expect(close).not.toHaveBeenCalled();
		expect(fixture.nativeElement.querySelector('[data-test="webhook-secrets"]')).not.toBeNull();
		dialog().close();
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Pixels and fonts' }));
	});

	it('compares later edits with the settings as last saved while it stays open on a secret', async () => {
		await open({}, 'on');
		webhooksApi.create.mockReturnValueOnce(of({ webhook: webhook('w-1', 'CI'), url: 'https://api.example.com/api/chat/hooks/s', signingSecret: 'k' }));
		tabTo('integrations');
		panel().patch({ name: 'CI' });
		panel().create();
		tabTo('settings');
		dialog().topic.set('Fonts');
		dialog().save();
		expect(close).not.toHaveBeenCalled();
		// Back to the topic the dialog opened with: a change against the saved one.
		dialog().topic.set('Pixels');
		expect(dialog().changes()).toEqual({ topic: 'Pixels' });
		expect(dialog().canSave()).toBe(true);
		dialog().topic.set('Fonts');
		expect(dialog().changes()).toEqual({});
	});

	it('closes on Save again once the secret was dismissed', async () => {
		await open({}, 'on');
		webhooksApi.create.mockReturnValueOnce(of({ webhook: webhook('w-1', 'CI'), url: 'https://api.example.com/api/chat/hooks/s', signingSecret: 'k' }));
		tabTo('integrations');
		panel().patch({ name: 'CI' });
		panel().create();
		fixture.detectChanges();
		(fixture.nativeElement.querySelector('[data-test="secrets-done"]') as HTMLButtonElement).click();
		dialog().topic.set('Pixels and fonts');
		dialog().save();
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Pixels and fonts' }));
	});

	it('stays open on a webhook write that failed while Close waited for it', async () => {
		await open({}, 'on');
		const write = new Subject<IChatWebhookWriteResult>();
		webhooksApi.update.mockReturnValueOnce(write);
		tabTo('integrations');
		panel().startEdit(webhook('w-1', 'CI'));
		panel().patch({ name: 'CI builds' });
		panel().saveEdit(webhook('w-1', 'CI'));
		tabTo('settings');
		dialog().close();
		write.error({ error: { message: 'The interaction URL must name a public host.' } });
		fixture.detectChanges();
		expect(close).not.toHaveBeenCalled();
		expect(dialog().tab()).toBe('integrations');
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-error"]')?.textContent).toContain('public host');
	});

	it('stays open on a webhook error that came before a Save running alongside it', async () => {
		await open({}, 'on');
		const write = new Subject<IChatWebhookWriteResult>();
		const saved = new Subject<{ conversation: IChatConversationWithState; events: never[] }>();
		webhooksApi.update.mockReturnValueOnce(write);
		api['updateConversation'].mockReturnValueOnce(saved);
		tabTo('integrations');
		panel().startEdit(webhook('w-1', 'CI'));
		panel().patch({ name: 'CI builds' });
		panel().saveEdit(webhook('w-1', 'CI'));
		tabTo('settings');
		dialog().topic.set('Pixels and fonts');
		dialog().save();
		// The webhook write fails first; then the settings are saved.
		write.error({ error: { message: 'The interaction URL must name a public host.' } });
		saved.next({ conversation: channel({ topic: 'Pixels and fonts' }), events: [] });
		saved.complete();
		fixture.detectChanges();
		expect(close).not.toHaveBeenCalled();
		expect(dialog().tab()).toBe('integrations');
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-error"]')?.textContent).toContain('public host');
		dialog().close();
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Pixels and fonts' }));
	});

	it('closes once a webhook write that made no secret ended', async () => {
		await open({}, 'on');
		const write = new Subject<IChatWebhookWriteResult>();
		webhooksApi.update.mockReturnValueOnce(write);
		tabTo('integrations');
		panel().startEdit(webhook('w-1', 'CI'));
		panel().patch({ name: 'CI builds' });
		panel().saveEdit(webhook('w-1', 'CI'));
		dialog().close();
		expect(close).not.toHaveBeenCalled();
		write.next({ webhook: webhook('w-1', 'CI builds') });
		write.complete();
		expect(close).toHaveBeenCalled();
	});

	it('closes from the backdrop and Escape through its own Close, which waits for a write', async () => {
		await open({});
		const write = new Subject<{ members: IChatMemberSummary[]; events: never[] }>();
		api['addMembers'].mockReturnValueOnce(write);
		dialog().toAdd.set([BOB]);
		dialog().add();
		backdrop.next(new MouseEvent('click'));
		document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }));
		expect(close).not.toHaveBeenCalled();
		expect(dialog().closeRequested()).toBe(true);
		write.next({ members, events: [] });
		write.complete();
		expect(close).toHaveBeenCalled();
	});

	it('closes at once from the backdrop when nothing is under way', async () => {
		await open({});
		backdrop.next(new MouseEvent('click'));
		expect(close).toHaveBeenCalledWith(null);
	});

	it('shows a failed webhook list on the Integrations tab with a retry, unlike a 404', async () => {
		await open({}, 'on');
		// The first read failed for another reason than webhooks being off.
		webhooksApi.list.mockReturnValueOnce(throwError(() => ({ status: 503 })));
		dialog().loadWebhooks();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-test="settings-tabs"]')).not.toBeNull();
		tabTo('integrations');
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-load-failed"]')).not.toBeNull();
		(fixture.nativeElement.querySelector('[data-test="webhooks-retry"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-load-failed"]')).toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-panel"]')).not.toBeNull();
	});

	it('keeps the Integrations tab through a retry, and moves to Settings when the retry finds webhooks off', async () => {
		await open({}, 'on');
		webhooksApi.list.mockReturnValueOnce(throwError(() => ({ status: 503 })));
		dialog().loadWebhooks();
		fixture.detectChanges();
		tabTo('integrations');
		const retry = new Subject<IChatWebhook[]>();
		webhooksApi.list.mockReturnValueOnce(retry);
		(fixture.nativeElement.querySelector('[data-test="webhooks-retry"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		// While the retry is under way, the tab and its failure stay on screen.
		expect(fixture.nativeElement.querySelector('[data-test="tab-integrations"]')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="webhooks-load-failed"]')).not.toBeNull();
		// It answers 404: webhooks are off here, so the tab goes and Settings shows.
		retry.error({ status: 404 });
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-test="tab-integrations"]')).toBeNull();
		expect(dialog().tab()).toBe('settings');
		expect(fixture.nativeElement.querySelector('[data-test="settings-name"]')).not.toBeNull();
	});

	it('wires the tabs to their panels and moves between them with the arrow keys, Home and End', async () => {
		await open({}, 'on');
		const tabs = fixture.nativeElement.querySelector('[data-test="settings-tabs"]') as HTMLElement;
		const settingsTab = fixture.nativeElement.querySelector('[data-test="tab-settings"]') as HTMLButtonElement;
		const membersTab = fixture.nativeElement.querySelector('[data-test="tab-members"]') as HTMLButtonElement;
		const integrationsTab = fixture.nativeElement.querySelector('[data-test="tab-integrations"]') as HTMLButtonElement;
		const panelId = settingsTab.getAttribute('aria-controls') as string;
		expect(fixture.nativeElement.querySelector(`#${panelId}`)?.getAttribute('role')).toBe('tabpanel');
		expect(settingsTab.getAttribute('tabindex')).toBe('0');
		expect(membersTab.getAttribute('tabindex')).toBe('-1');
		expect(integrationsTab.getAttribute('tabindex')).toBe('-1');
		tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		fixture.detectChanges();
		expect(dialog().tab()).toBe('members');
		expect(document.activeElement).toBe(membersTab);
		const membersPanel = fixture.nativeElement.querySelector(`#${membersTab.getAttribute('aria-controls')}`) as HTMLElement;
		expect(membersPanel.getAttribute('aria-labelledby')).toBe(membersTab.id);
		tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		fixture.detectChanges();
		expect(dialog().tab()).toBe('integrations');
		expect(document.activeElement).toBe(integrationsTab);
		const integrationsPanel = fixture.nativeElement.querySelector(`#${integrationsTab.getAttribute('aria-controls')}`) as HTMLElement;
		expect(integrationsPanel.getAttribute('aria-labelledby')).toBe(integrationsTab.id);
		tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		fixture.detectChanges();
		expect(dialog().tab()).toBe('settings');
		tabs.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(dialog().tab()).toBe('integrations');
	});

	it('closes with the saved settings even when a member change read, started before the save, answers after it', async () => {
		await open({});
		const read = new Subject<IChatConversationWithState>();
		api['getConversation'].mockReturnValueOnce(read);
		dialog().toAdd.set([BOB]);
		dialog().add();
		dialog().topic.set('Pixels and fonts');
		dialog().save();
		expect(close).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Pixels and fonts' }));
		// The older read answers last: it changes nothing any more.
		read.next(channel({ memberCount: 3 }));
		read.complete();
		expect(close).toHaveBeenCalledTimes(1);
		expect(dialog().changed).toEqual(expect.objectContaining({ topic: 'Pixels and fonts' }));
	});

	it('shows no Integrations tab where webhooks are off', async () => {
		await open({});
		expect(fixture.nativeElement.querySelector('[data-test="tab-settings"]')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="tab-members"]')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="tab-integrations"]')).toBeNull();
	});

	it('does not ask for webhooks of a channel I do not manage', async () => {
		await open({ canManage: false }, 'on');
		expect(webhooksApi.list).not.toHaveBeenCalled();
		expect(fixture.nativeElement.querySelector('[data-test="tab-integrations"]')).toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="settings-read-only"]')).not.toBeNull();
	});

	it('opens on the Members tab from the member count', async () => {
		await open({ section: 'members' });
		expect(dialog().tab()).toBe('members');
		expect(fixture.nativeElement.querySelector('[data-test="settings-members"]')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('[data-test="settings-name"]')).toBeNull();
	});

	it('narrows the members to the search, and says when nobody matches', async () => {
		await open({ section: 'members' });
		dialog().memberQuery.set('ann');
		fixture.detectChanges();
		expect(dialog().shownMembers().map((member: { name: string }) => member.name)).toEqual(['Anna']);
		dialog().memberQuery.set('zed');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[data-test="settings-members-empty"]')).not.toBeNull();
	});

	it('lists the members, managers first, and offers the people not in yet', async () => {
		await open({});
		tabTo('members');
		expect(api.members).toHaveBeenCalledWith('c1');
		expect(dialog().members().map((member: { name: string }) => member.name)).toEqual(['Me', 'Anna']);
		expect(dialog().addable().map((item: ChatPerson) => item.name)).toEqual(['Bob']);
		// Each row says the person's position where one is set, and their role.
		const meta = [...fixture.nativeElement.querySelectorAll('[data-test="member-meta"]')].map((item) => (item as HTMLElement).textContent?.replace(/\s+/g, ' ').trim());
		expect(meta).toEqual(['Designer · CHAT.SETTINGS.MANAGER', 'CHAT.SETTINGS.MEMBER']);
		// I am not offered to remove myself (that is leaving).
		expect(fixture.nativeElement.querySelector(`[data-test="remove-member-${ME}"]`)).toBeNull();
		expect(fixture.nativeElement.querySelector(`[data-test="remove-member-${ANNA}"]`)).not.toBeNull();
	});

	it('saves only what changed, and closes with the conversation the API answered', async () => {
		await open({ categories: [{ id: 'cat-1', name: 'Teams', position: 0 } as IChatCategory] });
		expect(dialog().canSave()).toBe(false);
		dialog().topic.set('  Pixels and fonts ');
		dialog().isPrivate.set(true);
		dialog().categoryId.set('cat-1');
		expect(dialog().changes()).toEqual({ topic: 'Pixels and fonts', visibility: ChatVisibilityEnum.PRIVATE, categoryId: 'cat-1' });
		dialog().save();
		expect(api.updateConversation).toHaveBeenCalledWith('c1', { topic: 'Pixels and fonts', visibility: ChatVisibilityEnum.PRIVATE, categoryId: 'cat-1' });
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', visibility: ChatVisibilityEnum.PRIVATE }));
	});

	it('closes with the conversation of the latest read after a member change, waiting for it', async () => {
		await open({});
		const read = new Subject<IChatConversationWithState>();
		api['getConversation'].mockReturnValueOnce(read);
		dialog().toAdd.set([BOB]);
		dialog().add();
		dialog().close();
		expect(close).not.toHaveBeenCalled();
		read.next(channel({ memberCount: 3 }));
		read.complete();
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ memberCount: 3 }));
	});

	it('waits for a member write under way and its read before closing, and starts no new write meanwhile', async () => {
		await open({});
		const write = new Subject<{ members: IChatMemberSummary[]; events: never[] }>();
		api['addMembers'].mockReturnValueOnce(write);
		dialog().toAdd.set([BOB]);
		dialog().add();
		dialog().close();
		expect(close).not.toHaveBeenCalled();
		// No new write once Close was asked for.
		dialog().remove(dialog().members().find((member: { employeeId: string }) => member.employeeId === ANNA));
		expect(api['removeMember']).not.toHaveBeenCalled();
		write.next({ members: [...members, { employeeId: BOB, userId: 'u-bob', role: ChatMemberRoleEnum.MEMBER }], events: [] });
		write.complete();
		// The read after the write answered at once (the mock): the dialog closes with it.
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
	});

	it('needs a name for a channel', async () => {
		await open({});
		dialog().name.set(' # ');
		dialog().topic.set('New topic');
		expect(dialog().canSave()).toBe(false);
	});

	it('adds and removes members, and closes with the conversation read again', async () => {
		await open({});
		jest.spyOn(window, 'confirm').mockReturnValue(true);
		dialog().toAdd.set([BOB]);
		dialog().add();
		expect(api.addMembers).toHaveBeenCalledWith('c1', [BOB]);
		expect(dialog().members().map((member: { name: string }) => member.name)).toEqual(['Me', 'Anna', 'Bob']);
		dialog().remove(dialog().members().find((member: { employeeId: string }) => member.employeeId === ANNA));
		expect(api.removeMember).toHaveBeenCalledWith('c1', ANNA);
		dialog().close();
		// Two added-then-removed changes: the conversation as read after the last one.
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ memberCount: 2 }));
	});

	it('changes nothing for a member who does not manage it', async () => {
		await open({ canManage: false });
		expect(dialog().canSave()).toBe(false);
		expect(dialog().canEditMembers()).toBe(false);
		expect(fixture.nativeElement.querySelector('[data-test="settings-save"]')).toBeNull();
	});

	it('changes no members of the default channel', async () => {
		await open({ conversation: channel({ isDefault: true }) });
		expect(dialog().canEditMembers()).toBe(false);
	});

	it('changes only the topic and no members of a direct conversation', async () => {
		await open({ conversation: channel({ kind: ChatConversationKindEnum.DIRECT, name: null }) });
		expect(dialog().canEditMembers()).toBe(false);
		// A direct conversation has no name or visibility to change: only its topic.
		dialog().topic.set('Just us');
		expect(dialog().changes()).toEqual({ topic: 'Just us' });
	});
});

describe('CategoriesDialogComponent', () => {
	let fixture: ComponentFixture<CategoriesDialogComponent>;
	let api: Record<string, jest.Mock>;
	let close: jest.Mock;
	const categories = [
		{ id: 'a', name: 'Teams', position: 0 },
		{ id: 'b', name: 'Clients', position: 1 },
		{ id: 'c', name: 'Projects', position: 2 }
	] as IChatCategory[];

	beforeEach(async () => {
		api = {
			createCategory: jest.fn((input) => of({ id: 'new', ...input })),
			updateCategory: jest.fn((id, input) => of({ ...categories.find((item) => item.id === id), ...input })),
			reorderCategories: jest.fn((input: { categoryIds: string[] }) =>
				of({
					categories: input.categoryIds.map((id, position) => ({ ...categories.find((item) => item.id === id), position })),
					conversations: [],
					events: []
				})
			),
			deleteCategory: jest.fn(() => of(undefined)),
			notifyChanged: jest.fn()
		};
		close = jest.fn();
		await TestBed.configureTestingModule({
			imports: [CategoriesDialogComponent],
			providers: [
				{ provide: ChatUiService, useValue: api },
				{ provide: ChatPresenceService, useValue: { presenceOf: () => 'offline', lastSeenOf: () => null, watch: () => NEVER, apply: () => undefined, applyList: () => undefined } },
				{ provide: NbDialogRef, useValue: { close } }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(CategoriesDialogComponent);
		fixture.componentInstance.categories = categories;
		fixture.detectChanges();
	});

	// The dialog's members are protected: the spec reaches them as the template does.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dialog = () => fixture.componentInstance as unknown as Record<string, any>;
	const order = () => dialog().ordered().map((item: IChatCategory) => item.name);

	it('moves a category with one reorder call, the whole order saved at once', () => {
		dialog().move('c', -1);
		expect(api.reorderCategories).toHaveBeenCalledTimes(1);
		expect(api.reorderCategories).toHaveBeenCalledWith({ categoryIds: ['a', 'c', 'b'] });
		expect(api.updateCategory).not.toHaveBeenCalled();
		expect(order()).toEqual(['Teams', 'Projects', 'Clients']);
	});

	it('adds a category at the end, renames one and deletes one, then says something changed', () => {
		jest.spyOn(window, 'confirm').mockReturnValue(true);
		dialog().newName.set(' Partners ');
		dialog().create();
		expect(api.createCategory).toHaveBeenCalledWith({ name: 'Partners', position: 3 });
		dialog().rename('a', 'People');
		dialog().saveName(categories[0]);
		expect(api.updateCategory).toHaveBeenCalledWith('a', { name: 'People' });
		dialog().remove(categories[1]);
		expect(api.deleteCategory).toHaveBeenCalledWith('b');
		expect(order()).toEqual(['People', 'Projects', 'Partners']);
		fixture.nativeElement.querySelector('nb-card-footer button').click();
		expect(close).toHaveBeenCalledWith(true);
	});

	it('closes only once a write under way ended', () => {
		const write = new Subject<IChatCategory>();
		api['updateCategory'].mockReturnValueOnce(write);
		dialog().rename('a', 'People');
		dialog().saveName(categories[0]);
		fixture.nativeElement.querySelector('[data-test="categories-close"]').click();
		expect(close).not.toHaveBeenCalled();
		write.next({ ...categories[0], name: 'People' });
		write.complete();
		expect(close).toHaveBeenCalledWith(true);
	});

	it('reads the categories again after a move failed, and blocks moves until a read succeeds', () => {
		api['reorderCategories'].mockReturnValueOnce(throwError(() => ({ error: { message: 'busy' } })));
		const read = new Subject<IChatCategory[]>();
		api['categories'] = jest.fn(() => read);
		dialog().move('c', -1);
		// The recovery read keeps the dialog busy.
		expect(dialog().busy()).toBe(true);
		read.error(new Error('offline'));
		expect(dialog().busy()).toBe(false);
		expect(dialog().stale()).toBe(true);
		dialog().move('b', -1);
		expect(api['reorderCategories']).toHaveBeenCalledTimes(1);

		api['categories'] = jest.fn(() => of([{ id: 'a', name: 'Teams', position: 0 }, { id: 'c', name: 'Projects', position: 1 }, { id: 'b', name: 'Clients', position: 1 }] as IChatCategory[]));
		dialog().reload();
		expect(dialog().stale()).toBe(false);
		expect(order()).toEqual(['Teams', 'Clients', 'Projects']);
	});

	it('keeps a name typed while its rename was being saved', () => {
		const write = new Subject<IChatCategory>();
		api['updateCategory'].mockReturnValueOnce(write);
		dialog().rename('a', 'People');
		dialog().saveName(categories[0]);
		dialog().rename('a', 'People team');
		write.next({ ...categories[0], name: 'People' });
		write.complete();
		expect(dialog().names()['a']).toBe('People team');
	});

	it('writes nothing for an unchanged name', () => {
		dialog().saveName(categories[0]);
		expect(api.updateCategory).not.toHaveBeenCalled();
	});
});
