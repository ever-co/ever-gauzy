/**
 * The component is exercised by instantiating it directly — the package's
 * established test shape (`documents.service.spec.ts`, `document-tree.store.spec.ts`).
 * Both `@gauzy/ui-core` barrels are stubbed: `core` drags Akita's untranspiled
 * ESM into the CommonJS runtime, and `i18n` only contributes the translation base
 * class, whose single job here is `getTranslation()`.
 */
jest.mock('@gauzy/ui-core/core', () => ({
	EmployeesService: class EmployeesService {},
	Store: class Store {},
	ToastrService: class ToastrService {}
}));
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class TranslationBaseComponent {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));

import { of, throwError } from 'rxjs';
import { BaseEntityEnum, IComment, ID, PermissionsEnum } from '@gauzy/contracts';
import { DocumentCommentsComponent } from './document-comments.component';

const DOCUMENT_ID = 'cccccccc-1111-4111-8111-111111111111' as ID;
const ME = 'employee-me';
const SOMEONE_ELSE = 'employee-other';

const comment = (overrides: Partial<IComment> = {}): IComment =>
	({
		id: 'c1',
		comment: 'hello',
		employeeId: ME,
		createdAt: new Date('2026-01-01T10:00:00Z'),
		...overrides
	} as unknown as IComment);

/** Records every call so a test can assert the wire shape without an HTTP layer. */
class CommentsServiceStub {
	public items: IComment[] = [];
	public created: unknown[] = [];
	public updated: { id: ID; input: unknown }[] = [];
	public deleted: ID[] = [];
	public failGetAll = false;

	getAll = jest.fn(() =>
		this.failGetAll ? throwError(() => new Error('boom')) : of({ items: this.items, total: this.items.length })
	);
	create = jest.fn((input: Record<string, unknown>) => {
		this.created.push(input);
		return of(
			comment({
				id: `new-${this.created.length}`,
				comment: input['comment'] as string,
				parentId: input['parentId'] as ID,
				createdAt: new Date('2026-01-01T12:00:00Z')
			})
		);
	});
	update = jest.fn((id: ID, input: Record<string, unknown>) => {
		this.updated.push({ id, input });
		return of(comment({ id, ...input } as Partial<IComment>));
	});
	delete = jest.fn((id: ID) => {
		this.deleted.push(id);
		return of(null);
	});
}

interface IHarness {
	component: DocumentCommentsComponent;
	comments: CommentsServiceStub;
	toastr: { success: jest.Mock; danger: jest.Mock };
}

function harness(options: { employeeId?: string | null; permissions?: PermissionsEnum[] } = {}): IHarness {
	const granted = new Set(options.permissions ?? [PermissionsEnum.DOCS_READ]);
	const employeeId = options.employeeId === undefined ? ME : options.employeeId;

	const comments = new CommentsServiceStub();
	const directory = { search: () => of([]), matchInText: () => of([]) };
	const toastr = { success: jest.fn(), danger: jest.fn() };
	const store = {
		hasPermission: (permission: PermissionsEnum) => granted.has(permission),
		user: employeeId ? { employee: { id: employeeId } } : {}
	};

	const component = new DocumentCommentsComponent(
		{ instant: (key: string) => key } as never,
		comments as never,
		directory as never,
		toastr as never,
		store as never
	);
	component.documentId = DOCUMENT_ID;
	component.documentName = 'Handbook.pdf';

	return { component, comments, toastr };
}

describe('DocumentCommentsComponent', () => {
	describe('loading', () => {
		it('threads the page on documentId change', async () => {
			const { component, comments } = harness();
			comments.items = [
				comment({ id: 'root', createdAt: new Date('2026-01-01T10:00:00Z') }),
				comment({ id: 'reply', parentId: 'root' as ID, createdAt: new Date('2026-01-01T10:05:00Z') })
			];

			component.ngOnChanges({ documentId: { firstChange: true } as never });
			await Promise.resolve();
			await Promise.resolve();

			expect(comments.getAll).toHaveBeenCalledWith(DOCUMENT_ID);
			expect(component.nodes).toHaveLength(1);
			expect(component.nodes[0].replies.map((reply) => reply.id)).toEqual(['reply']);
			expect(component.total).toBe(2);
			expect(component.loadError).toBe(false);
		});

		it('shows the error state — not a toast — when the thread cannot load', async () => {
			const { component, comments, toastr } = harness();
			comments.failGetAll = true;

			await component.reload();

			expect(component.loadError).toBe(true);
			expect(component.nodes).toEqual([]);
			expect(component.loading).toBe(false);
			expect(toastr.danger).not.toHaveBeenCalled();
		});
	});

	describe('posting', () => {
		it('posts against (Document, id) and carries the mention ids the backend fans out from', async () => {
			const { component, comments } = harness();

			await component.post({ comment: 'hi @Jo Smith', mentionEmployeeIds: ['e1' as ID] });

			expect(comments.created).toEqual([
				{
					entity: BaseEntityEnum.Document,
					entityId: DOCUMENT_ID,
					entityName: 'Handbook.pdf',
					comment: 'hi @Jo Smith',
					mentionEmployeeIds: ['e1']
				}
			]);
			expect(component.nodes).toHaveLength(1);
			expect(component.posting).toBe(false);
		});

		it('surfaces a failed post and leaves the thread untouched', async () => {
			const { component, comments, toastr } = harness();
			comments.create = jest.fn(() => throwError(() => new Error('nope')));

			await component.post({ comment: 'hi', mentionEmployeeIds: [] });

			expect(toastr.danger).toHaveBeenCalled();
			expect(component.nodes).toEqual([]);
			expect(component.posting).toBe(false);
		});

		it('nests a reply under its parent and sends parentId', async () => {
			const { component, comments } = harness();
			comments.items = [comment({ id: 'root' })];
			await component.reload();

			component.startReply(component.nodes[0].comment);
			expect(component.isReplying(component.nodes[0].comment)).toBe(true);

			await component.reply(component.nodes[0].comment, { comment: 'a reply', mentionEmployeeIds: [] });

			expect((comments.created[0] as Record<string, unknown>)['parentId']).toBe('root');
			expect(component.nodes).toHaveLength(1);
			expect(component.nodes[0].replies).toHaveLength(1);
			expect(component.replyingTo).toBeNull();
		});
	});

	describe('resolve', () => {
		it('resolves with a timestamp and reopens by clearing it', async () => {
			const { component, comments } = harness();
			comments.items = [comment({ id: 'c1' })];
			await component.reload();

			await component.toggleResolved(component.nodes[0].comment);
			expect(comments.updated[0].id).toBe('c1');
			expect((comments.updated[0].input as Record<string, unknown>)['resolved']).toBe(true);
			expect((comments.updated[0].input as Record<string, unknown>)['resolvedAt']).toBeInstanceOf(Date);
			expect(component.nodes[0].comment.resolved).toBe(true);

			await component.toggleResolved(component.nodes[0].comment);
			expect((comments.updated[1].input as Record<string, unknown>)['resolved']).toBe(false);
			// A stale resolvedAt would keep reading as "resolved" everywhere else.
			expect((comments.updated[1].input as Record<string, unknown>)['resolvedAt']).toBeNull();
			expect(component.nodes[0].comment.resolved).toBe(false);
		});
	});

	describe('editing', () => {
		it('re-sends the body with an editedAt stamp', async () => {
			const { component, comments } = harness();
			comments.items = [comment({ id: 'c1' })];
			await component.reload();

			await component.saveEdit(component.nodes[0].comment, { comment: 'edited', mentionEmployeeIds: ['e1' as ID] });

			const input = comments.updated[0].input as Record<string, unknown>;
			expect(input['comment']).toBe('edited');
			expect(input['mentionEmployeeIds']).toEqual(['e1']);
			expect(input['editedAt']).toBeInstanceOf(Date);
			expect(component.editingId).toBeNull();
		});
	});

	describe('permission gating', () => {
		it('allows commenting for a DOCS_READ holder who has an employee record', () => {
			const { component } = harness();

			expect(component.canRead).toBe(true);
			expect(component.canComment).toBe(true);
			expect(component.commentingUnavailable).toBe(false);
		});

		it('blocks commenting without DOCS_READ', () => {
			const { component } = harness({ permissions: [] });

			expect(component.canRead).toBe(false);
			expect(component.canComment).toBe(false);
		});

		it('blocks commenting for a user with no employee record — the API would 400', async () => {
			// `CommentService.create()` resolves the author from the request context
			// and throws NotFoundException when that employee does not exist.
			const { component, comments } = harness({ employeeId: null });

			expect(component.canComment).toBe(false);
			expect(component.commentingUnavailable).toBe(true);

			await component.post({ comment: 'hi', mentionEmployeeIds: [] });
			expect(comments.create).not.toHaveBeenCalled();
		});

		it('offers edit and resolve on own comments only — the update is author-scoped server-side', () => {
			const { component } = harness();
			const mine = comment({ id: 'mine', employeeId: ME });
			const theirs = comment({ id: 'theirs', employeeId: SOMEONE_ELSE });

			expect(component.isOwn(mine)).toBe(true);
			expect(component.canEdit(mine)).toBe(true);
			expect(component.canResolve(mine)).toBe(true);

			expect(component.isOwn(theirs)).toBe(false);
			expect(component.canEdit(theirs)).toBe(false);
			expect(component.canResolve(theirs)).toBe(false);
		});

		it('never issues a request for a resolve the backend would reject', async () => {
			const { component, comments } = harness();
			comments.items = [comment({ id: 'theirs', employeeId: SOMEONE_ELSE })];
			await component.reload();

			await component.toggleResolved(component.nodes[0].comment);

			expect(comments.update).not.toHaveBeenCalled();
		});

		it('restricts delete to the author, and to DOCS_MANAGE holders for moderation', async () => {
			const author = harness();
			const moderator = harness({ permissions: [PermissionsEnum.DOCS_READ, PermissionsEnum.DOCS_MANAGE] });
			const plain = harness();
			const theirs = comment({ id: 'theirs', employeeId: SOMEONE_ELSE });

			expect(author.component.canDelete(comment({ employeeId: ME }))).toBe(true);
			expect(moderator.component.canDelete(theirs)).toBe(true);
			expect(plain.component.canDelete(theirs)).toBe(false);

			plain.comments.items = [theirs];
			await plain.component.reload();
			await plain.component.remove(plain.component.nodes[0].comment);
			expect(plain.comments.delete).not.toHaveBeenCalled();
		});

		it('removes a deleted comment from the thread', async () => {
			const { component, comments } = harness();
			comments.items = [comment({ id: 'c1' })];
			await component.reload();

			await component.remove(component.nodes[0].comment);

			expect(comments.deleted).toEqual(['c1']);
			expect(component.nodes).toEqual([]);
			expect(component.total).toBe(0);
		});
	});
});
