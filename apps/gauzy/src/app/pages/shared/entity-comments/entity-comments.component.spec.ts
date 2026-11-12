// The services the component injects, as DI tokens: the real barrel pulls the whole app (cookies, auth) into the test.
jest.mock('@gauzy/ui-core/core', () => ({
	CommentService: class CommentService {},
	CommentReactionService: class CommentReactionService {},
	ImageAssetService: class ImageAssetService {},
	Store: class Store {},
	ToastrService: class ToastrService {}
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { BaseEntityEnum, IComment, IReactionSummary, PermissionsEnum, ReactionEntityEnum } from '@gauzy/contracts';
import { CommentReactionService, CommentService, ImageAssetService, Store, ToastrService } from '@gauzy/ui-core/core';
import { DEFAULT_ENTITY_COMMENTS_LABELS, EntityCommentsComponent } from './entity-comments.component';

const CONTACT = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const TENANT = 'dddddddd-4444-4444-8444-444444444444';
const ME = { id: 'user-me', employee: { id: 'employee-me' } };

const comment = (id: string, minute: number, overrides: Partial<IComment> = {}): IComment =>
	({
		id,
		comment: `Note ${id}`,
		entity: BaseEntityEnum.OrganizationContact,
		entityId: CONTACT,
		employeeId: ME.employee.id,
		createdAt: new Date(Date.UTC(2026, 9, 30, 9, minute)),
		...overrides
	}) as IComment;

/** The contact's notes as the server lists them, oldest first: two notes, and a later reply to the first. */
const NOTES = [comment('first', 0), comment('second', 5), comment('reply', 10, { parentId: 'first' })];

/**
 * The discussion on a record, shared by a project's Comments tab and a contact's Notes tab (ever-co/ever-gauzy#1114):
 * which record it reads and writes, its order, its wording, and what a reader who may not write is offered.
 */
describe('EntityCommentsComponent', () => {
	let listed: IComment[];
	let permissions: Set<PermissionsEnum>;
	let comments: { getAll: jest.Mock; create: jest.Mock; delete: jest.Mock };
	let toastr: { success: jest.Mock; danger: jest.Mock; warning: jest.Mock };
	let reactions: { getForRecord: jest.Mock; toggle: jest.Mock };
	let summaries: IReactionSummary[];
	let user: Record<string, unknown> | null;

	beforeEach(() => {
		listed = NOTES;
		permissions = new Set();
		comments = {
			getAll: jest.fn(async () => ({ items: listed, total: listed.length })),
			create: jest.fn(async () => ({})),
			delete: jest.fn(async () => undefined)
		};
		toastr = { success: jest.fn(), danger: jest.fn(), warning: jest.fn() };
		summaries = [];
		reactions = {
			getForRecord: jest.fn(async () => summaries),
			toggle: jest.fn(async () => undefined)
		};
		user = ME;
		const store = {
			get user() {
				return user;
			},
			hasPermission: (permission: PermissionsEnum) => permissions.has(permission),
			hasAllPermissions: (...required: PermissionsEnum[]) => required.every((p) => permissions.has(p)),
			hasAnyPermission: (...required: PermissionsEnum[]) => required.some((p) => permissions.has(p))
		};
		const imageAssets = { getById: jest.fn(), upload: jest.fn(), deleteImageAsset: jest.fn(async () => undefined) };

		TestBed.configureTestingModule({
			providers: [
				{ provide: CommentService, useValue: comments },
				{ provide: CommentReactionService, useValue: reactions },
				{ provide: Store, useValue: store },
				{ provide: ToastrService, useValue: toastr }
			]
		});
		// The component provides its own image asset service; the spec's stands in for it.
		TestBed.overrideComponent(EntityCommentsComponent, {
			set: { providers: [{ provide: ImageAssetService, useValue: imageAssets }] }
		});
	});

	/** The comments of a contact, read and drawn. */
	const render = async (inputs: Record<string, unknown> = {}): Promise<ComponentFixture<EntityCommentsComponent>> => {
		const fixture = TestBed.createComponent(EntityCommentsComponent);
		const all = {
			entity: BaseEntityEnum.OrganizationContact,
			entityId: CONTACT,
			entityName: 'Acme',
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			...inputs
		};
		for (const [name, value] of Object.entries(all)) fixture.componentRef.setInput(name, value);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return fixture;
	};

	const element = (fixture: ComponentFixture<EntityCommentsComponent>): HTMLElement => fixture.nativeElement;
	const texts = (fixture: ComponentFixture<EntityCommentsComponent>, selector: string): string[] =>
		Array.from(element(fixture).querySelectorAll(selector)).map((node) => node.textContent.trim());
	/** The component's own state, which the template reads. */
	const state = (fixture: ComponentFixture<EntityCommentsComponent>): any => fixture.componentInstance;

	it('reads and posts the comments of the record it is given, in its organization', async () => {
		const fixture = await render();

		expect(comments.getAll).toHaveBeenCalledWith(BaseEntityEnum.OrganizationContact, CONTACT, {
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});

		state(fixture).commentControl.setValue('Call back on Monday');
		await state(fixture).addComment();

		expect(comments.create).toHaveBeenCalledWith({
			comment: 'Call back on Monday',
			entity: BaseEntityEnum.OrganizationContact,
			entityId: CONTACT,
			entityName: 'Acme',
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
	});

	it('lists oldest first under no option, with the box under the list (the project page, unchanged)', async () => {
		const fixture = await render({ entity: BaseEntityEnum.OrganizationProject });

		expect(texts(fixture, 'li.comment > .comment-main .comment-text')).toEqual(['Note first', 'Note second']);
		expect(element(fixture).querySelector('footer.comment-footer textarea')).not.toBeNull();
		expect(element(fixture).querySelector('header.comment-footer--top')).toBeNull();
	});

	it('lists newest first with the box above the list, keeping each thread oldest first', async () => {
		const fixture = await render({ newestFirst: true });

		expect(texts(fixture, 'li.comment > .comment-main .comment-text')).toEqual(['Note second', 'Note first']);
		expect(state(fixture).threads.value[1].replies.map((reply) => reply.comment.id)).toEqual(['reply']);
		expect(element(fixture).querySelector('header.comment-footer--top textarea')).not.toBeNull();
		expect(element(fixture).querySelector('footer.comment-footer')).toBeNull();
	});

	it('offers a reader who may not write no box, no reply and no delete, even over their own notes', async () => {
		// A CHANGE_SELECTED_EMPLOYEE holder may delete any comment where writing is allowed.
		permissions.add(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		const fixture = await render({ canWrite: false, newestFirst: true });

		expect(texts(fixture, 'li.comment > .comment-main .comment-text')).toEqual(['Note second', 'Note first']);
		expect(element(fixture).querySelector('textarea')).toBeNull();
		expect(element(fixture).querySelector('.comment-actions')).toBeNull();
		const entries = state(fixture).threads.value.flatMap((thread) => [thread.entry, ...thread.replies]);
		expect(entries.map((entry) => entry.canDelete)).toEqual([false, false, false]);
	});

	it('offers a writer delete on the notes the server lets them delete', async () => {
		listed = [comment('mine', 0), comment('theirs', 5, { employeeId: 'employee-other' })];
		const fixture = await render();

		const entries = state(fixture).threads.value.map((thread) => [thread.entry.comment.id, thread.entry.canDelete]);
		expect(entries).toEqual([
			['mine', true],
			['theirs', false]
		]);
	});

	it('names the comments with the labels it is given, keeping the default for any left out', async () => {
		listed = [];
		const fixture = await render({
			labels: { empty: 'CONTACTS_PAGE.NO_NOTES', placeholder: 'CONTACTS_PAGE.NOTE_PLACEHOLDER' }
		});

		expect(texts(fixture, '.empty-state')).toEqual(['CONTACTS_PAGE.NO_NOTES']);
		const box = element(fixture).querySelector('textarea');
		expect(box.getAttribute('placeholder')).toBe('CONTACTS_PAGE.NOTE_PLACEHOLDER');
		expect(element(fixture).querySelector('.composer-send').getAttribute('aria-label')).toBe(
			DEFAULT_ENTITY_COMMENTS_LABELS.send
		);
	});

	it('confirms a delete in the words it is given', async () => {
		const fixture = await render({ labels: { deleted: 'CONTACTS_PAGE.NOTE_DELETED' } });

		await state(fixture).deleteComment(NOTES[1]);

		expect(comments.delete).toHaveBeenCalledWith('second');
		expect(toastr.success).toHaveBeenCalledWith('CONTACTS_PAGE.NOTE_DELETED');
	});

	it('marks the comment it is pointed at, opens its thread when it is a reply, and scrolls to it once', async () => {
		const original = Element.prototype.scrollIntoView;
		const scrolled: string[] = [];
		Element.prototype.scrollIntoView = function () {
			scrolled.push(this.getAttribute('data-comment-id'));
		} as never;
		try {
			const fixture = await render({ highlightCommentId: 'reply' });
			await new Promise((resolve) => setTimeout(resolve));
			fixture.detectChanges();

			expect(state(fixture).openThreadId).toBe('first');
			expect(element(fixture).querySelector('.reply.highlighted')?.getAttribute('data-comment-id')).toBe('reply');
			expect(scrolled).toEqual(['reply']);

			// A refresh (after a post, say) leaves the reader where they are: no second scroll, the thread as they left it.
			state(fixture).openThreadId = null;
			await state(fixture).load();
			await new Promise((resolve) => setTimeout(resolve));
			expect(scrolled).toEqual(['reply']);
			expect(state(fixture).openThreadId).toBeNull();

			// Another comment pointed at later: marked in turn; one the list does not hold changes nothing.
			fixture.componentRef.setInput('highlightCommentId', 'second');
			fixture.detectChanges();
			await new Promise((resolve) => setTimeout(resolve));
			expect(element(fixture).querySelector('.comment.highlighted')?.getAttribute('data-comment-id')).toBe('second');
			expect(scrolled).toEqual(['reply', 'second']);
			fixture.componentRef.setInput('highlightCommentId', 'missing');
			fixture.detectChanges();
			expect(element(fixture).querySelector('.highlighted')).toBeNull();
		} finally {
			Element.prototype.scrollIntoView = original;
		}
	});

	it('gives each instance on a page its own box ids', async () => {
		const first = await render();
		const second = await render();

		const ids = [first, second].map((fixture) => element(fixture).querySelector('textarea').id);
		expect(ids[0]).not.toEqual(ids[1]);
		expect(ids.every((id) => id.endsWith('-comment'))).toBe(true);
	});
	describe('reactions (the task page)', () => {
		const thumbs = (overrides: Partial<IReactionSummary> = {}): IReactionSummary => ({
			entity: ReactionEntityEnum.Comment,
			entityId: 'first',
			emoji: '👍',
			count: 1,
			reactedByMe: false,
			reactionId: null,
			reactors: [{ employeeId: 'employee-ann', name: 'Ann Lee' }],
			...overrides
		});
		const chips = (fixture: ComponentFixture<EntityCommentsComponent>) =>
			Array.from(element(fixture).querySelectorAll<HTMLButtonElement>('li.comment > .comment-main .reaction-chip:not(.reaction-add)'));

		it('asks for nothing where reactions are not asked for (a project, a contact)', async () => {
			const fixture = await render();

			expect(reactions.getForRecord).not.toHaveBeenCalled();
			expect(element(fixture).querySelector('.comment-reactions')).toBeNull();
		});

		it('reads the reactions of the record and draws a chip per emoji, the reader’s own marked', async () => {
			summaries = [thumbs(), thumbs({ emoji: '🎉', reactedByMe: true, reactors: [{ employeeId: 'employee-me', name: 'Me' }] })];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			fixture.detectChanges();

			expect(reactions.getForRecord).toHaveBeenCalledWith(BaseEntityEnum.Task, CONTACT, {
				organizationId: ORGANIZATION,
				tenantId: TENANT
			});
			const drawn = chips(fixture);
			expect(drawn.map((chip) => chip.textContent.replace(/\s+/g, ''))).toEqual(['👍1', '🎉1']);
			expect(drawn.map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
			expect(drawn[0].getAttribute('aria-label')).toBe('COMMENT_REACTIONS.REACTED_WITH');
		});

		it('shows a toggle at once, sends it, and reads the summary again', async () => {
			summaries = [thumbs()];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			let release: () => void = () => undefined;
			reactions.toggle.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));

			const pending = state(fixture).toggleReaction('first', '👍');
			fixture.detectChanges();
			expect(chips(fixture)[0].textContent.replace(/\s+/g, '')).toBe('👍2');
			expect(chips(fixture)[0].getAttribute('aria-pressed')).toBe('true');

			summaries = [thumbs({ count: 2, reactedByMe: true })];
			release();
			await pending;
			expect(reactions.toggle).toHaveBeenCalledWith('first', '👍', { organizationId: ORGANIZATION, tenantId: TENANT });
			expect(reactions.getForRecord).toHaveBeenCalledTimes(2);
		});

		it('puts the chips back and says so when the platform refuses a toggle', async () => {
			summaries = [thumbs()];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			reactions.toggle.mockRejectedValue(new Error('404'));

			await state(fixture).toggleReaction('first', '🚀');
			fixture.detectChanges();

			expect(chips(fixture).map((chip) => chip.textContent.replace(/\s+/g, ''))).toEqual(['👍1']);
			expect(toastr.danger).toHaveBeenCalledWith('COMMENT_REACTIONS.FAILED', 'TOASTR.TITLE.ERROR');
		});

		it('shows what the platform holds after a refused toggle, keeping a toggle that landed meanwhile', async () => {
			summaries = [thumbs()];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			reactions.toggle.mockRejectedValueOnce(new Error('503'));
			// The heart sent meanwhile landed: the platform holds it, the refused rocket not.
			summaries = [thumbs(), thumbs({ emoji: '❤️', reactedByMe: true })];

			await state(fixture).toggleReaction('first', '🚀');
			fixture.detectChanges();

			expect(chips(fixture).map((chip) => chip.textContent.replace(/\s+/g, ''))).toEqual(['👍1', '❤️1']);
			expect(reactions.getForRecord).toHaveBeenCalledTimes(2);
			expect(toastr.danger).toHaveBeenCalledWith('COMMENT_REACTIONS.FAILED', 'TOASTR.TITLE.ERROR');
		});

		it('words the chips again in the reader’s new language', async () => {
			summaries = [thumbs()];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			const translate = TestBed.inject(TranslateService);
			translate.setTranslation('es', { COMMENT_REACTIONS: { REACTED_WITH: 'Reacted in Spanish {{emoji}}: {{people}}' } });

			translate.use('es');
			await fixture.whenStable();
			fixture.detectChanges();

			expect(chips(fixture)[0].getAttribute('aria-label')).toContain('Reacted in Spanish');
		});

		it('hides reactions on a platform without the summary', async () => {
			reactions.getForRecord.mockRejectedValue({ status: 404 });
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			fixture.detectChanges();

			expect(element(fixture).querySelector('.comment-reactions')).toBeNull();
			expect(texts(fixture, 'li.comment > .comment-main .comment-text')).toEqual(['Note first', 'Note second']);
		});

		it('lets a reader without an employee see the chips, not react', async () => {
			user = { id: 'user-me' };
			summaries = [thumbs()];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			fixture.detectChanges();

			// Focusable, so a keyboard reader reaches its label (who reacted), but it does nothing.
			expect(chips(fixture)[0].disabled).toBe(false);
			expect(chips(fixture)[0].getAttribute('aria-disabled')).toBe('true');
			expect(element(fixture).querySelector('.reaction-add')).toBeNull();
			chips(fixture)[0].click();
			await state(fixture).toggleReaction('first', '👍');
			expect(reactions.toggle).not.toHaveBeenCalled();
		});

		it('gives the keyboard back to the smiley when the palette closes', async () => {
			summaries = [thumbs()];
			const fixture = await render({ entity: BaseEntityEnum.Task, reactions: true });
			await fixture.whenStable();
			fixture.detectChanges();
			const opener = () => element(fixture).querySelector<HTMLButtonElement>('li.comment > .comment-main .reaction-add');

			opener()?.click();
			fixture.detectChanges();
			const palette = element(fixture).querySelector<HTMLElement>('.reaction-palette');
			expect(palette).not.toBeNull();
			palette?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			fixture.detectChanges();
			expect(element(fixture).querySelector('.reaction-palette')).toBeNull();
			expect(document.activeElement).toBe(opener());

			opener()?.click();
			fixture.detectChanges();
			element(fixture).querySelector<HTMLButtonElement>('.reaction-palette .reaction-pick')?.click();
			await fixture.whenStable();
			fixture.detectChanges();
			expect(reactions.toggle).toHaveBeenCalledWith('first', '👍', { organizationId: ORGANIZATION, tenantId: TENANT });
			expect(document.activeElement).toBe(opener());
		});
	});
});
