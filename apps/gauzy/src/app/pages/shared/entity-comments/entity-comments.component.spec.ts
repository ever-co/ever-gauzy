import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BaseEntityEnum, IComment, PermissionsEnum } from '@gauzy/contracts';
import { CommentService, ImageAssetService, Store, ToastrService } from '@gauzy/ui-core/core';
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

	beforeEach(() => {
		listed = NOTES;
		permissions = new Set();
		comments = {
			getAll: jest.fn(async () => ({ items: listed, total: listed.length })),
			create: jest.fn(async () => ({})),
			delete: jest.fn(async () => undefined)
		};
		toastr = { success: jest.fn(), danger: jest.fn(), warning: jest.fn() };
		const store = {
			user: ME,
			hasPermission: (permission: PermissionsEnum) => permissions.has(permission),
			hasAllPermissions: (...required: PermissionsEnum[]) => required.every((p) => permissions.has(p)),
			hasAnyPermission: (...required: PermissionsEnum[]) => required.some((p) => permissions.has(p))
		};
		const imageAssets = { getById: jest.fn(), upload: jest.fn(), deleteImageAsset: jest.fn(async () => undefined) };

		TestBed.configureTestingModule({
			providers: [
				{ provide: CommentService, useValue: comments },
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

	it('gives each instance on a page its own box ids', async () => {
		const first = await render();
		const second = await render();

		const ids = [first, second].map((fixture) => element(fixture).querySelector('textarea').id);
		expect(ids[0]).not.toEqual(ids[1]);
		expect(ids.every((id) => id.endsWith('-comment'))).toBe(true);
	});
});
