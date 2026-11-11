// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { of, Subject, throwError } from 'rxjs';
import {
	ChatConversationKindEnum,
	ChatMemberRoleEnum,
	ChatVisibilityEnum,
	IChatCategory,
	IChatConversationWithState,
	IChatMemberSummary
} from '@gauzy/contracts';
import { ChatPerson } from '../chat-ui.helpers';
import { ChatUiService } from '../services/chat-ui.service';
import { ChatWebhooksService } from '../services/chat-webhooks.service';
import { CategoriesDialogComponent, ChannelSettingsContext, ChannelSettingsDialogComponent } from './chat-settings-dialogs.component';

const ME = 'e-me';
const ANNA = 'e-anna';
const BOB = 'e-bob';
const person = (employeeId: string, name: string): ChatPerson => ({ employeeId, userId: `u-${employeeId}`, name, imageUrl: null });
const people = [person(ME, 'Me'), person(ANNA, 'Anna'), person(BOB, 'Bob')];
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
	let webhooksApi: { list: jest.Mock };

	async function open(context: Partial<ChannelSettingsContext>, webhooks: 'off' | 'on' = 'off'): Promise<void> {
		// Where the API serves no webhooks, their list answers 404.
		webhooksApi = { list: jest.fn(() => (webhooks === 'on' ? of([]) : throwError(() => ({ status: 404 })))) };
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
				{ provide: ChatWebhooksService, useValue: webhooksApi },
				{ provide: NbDialogRef, useValue: { close } }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(ChannelSettingsDialogComponent);
		fixture.componentInstance.context = { conversation: channel(), categories: [], people: PEOPLE, meEmployeeId: ME, canManage: true, ...context };
		fixture.detectChanges();
	}

	// The dialog's members are protected: the spec reaches them as the template does.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dialog = () => fixture.componentInstance as unknown as Record<string, any>;

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

	it('shows no Integrations tab where webhooks are off', async () => {
		await open({});
		expect(fixture.nativeElement.querySelector('[data-test="settings-tabs"]')).toBeNull();
	});

	it('does not ask for webhooks of a channel I do not manage', async () => {
		await open({ canManage: false }, 'on');
		expect(webhooksApi.list).not.toHaveBeenCalled();
		expect(fixture.nativeElement.querySelector('[data-test="settings-tabs"]')).toBeNull();
	});

	it('lists the members, managers first, and offers the people not in yet', async () => {
		await open({});
		expect(api.members).toHaveBeenCalledWith('c1');
		expect(dialog().members().map((member: { name: string }) => member.name)).toEqual(['Me', 'Anna']);
		expect(dialog().addable().map((item: ChatPerson) => item.name)).toEqual(['Bob']);
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
			deleteCategory: jest.fn(() => of(undefined)),
			notifyChanged: jest.fn()
		};
		close = jest.fn();
		await TestBed.configureTestingModule({
			imports: [CategoriesDialogComponent],
			providers: [
				{ provide: ChatUiService, useValue: api },
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

	it('moves a category by writing the positions that changed', () => {
		dialog().move('c', -1);
		expect(api.updateCategory).toHaveBeenCalledTimes(2);
		expect(api.updateCategory).toHaveBeenCalledWith('c', { position: 1 });
		expect(api.updateCategory).toHaveBeenCalledWith('b', { position: 2 });
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

	it('reads the categories again after a move failed part way, and blocks moves until a read succeeds', () => {
		api['updateCategory'].mockReturnValueOnce(of({ ...categories[2], position: 1 })).mockReturnValueOnce(throwError(() => ({ error: { message: 'busy' } })));
		const read = new Subject<IChatCategory[]>();
		api['categories'] = jest.fn(() => read);
		dialog().move('c', -1);
		// The recovery read keeps the dialog busy.
		expect(dialog().busy()).toBe(true);
		read.error(new Error('offline'));
		expect(dialog().busy()).toBe(false);
		expect(dialog().stale()).toBe(true);
		dialog().move('b', -1);
		expect(api['updateCategory']).toHaveBeenCalledTimes(2);

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
