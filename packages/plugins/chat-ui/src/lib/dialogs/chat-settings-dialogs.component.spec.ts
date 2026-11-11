// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NbDialogRef } from '@nebular/theme';
import { of } from 'rxjs';
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

	async function open(context: Partial<ChannelSettingsContext>): Promise<void> {
		api = {
			members: jest.fn(() => of(members)),
			updateConversation: jest.fn((_id, input) => of({ conversation: channel(input), events: [] })),
			addMembers: jest.fn((_id, ids: string[]) => of({ members: [...members, ...ids.map((employeeId) => ({ employeeId, userId: `u-${employeeId}`, role: ChatMemberRoleEnum.MEMBER }))], events: [] })),
			removeMember: jest.fn(() => of({ events: [] })),
			getConversation: jest.fn(() => of(channel({ memberCount: 3 }))),
			notifyChanged: jest.fn()
		};
		close = jest.fn();
		await TestBed.configureTestingModule({
			imports: [ChannelSettingsDialogComponent],
			providers: [
				{ provide: ChatUiService, useValue: api },
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
		expect(close).toHaveBeenCalledWith(expect.objectContaining({ memberCount: 3 }));
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

	it('writes nothing for an unchanged name', () => {
		dialog().saveName(categories[0]);
		expect(api.updateCategory).not.toHaveBeenCalled();
	});
});
