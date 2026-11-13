/**
 * `@gauzy/ui-core/core` is a barrel over the whole app core: importing it pulls Akita's untranspiled ESM into the
 * CommonJS test runtime. The rail only uses these classes as DI tokens.
 */
jest.mock('@gauzy/ui-core/core', () => ({
	EmployeesService: class EmployeesService {},
	Store: class Store {},
	ToastrService: class ToastrService {}
}));

import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA, Pipe, type PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import {
	DocumentCommentAnchorMethodEnum,
	DocumentCommentAnchorStatusEnum,
	type IComment,
	type IDocumentCommentAnchorInput,
	type IDocumentCommentAnchorPosition,
	type IDocumentCommentAnchorResolved,
	PermissionsEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { DocumentCommentsService } from '../../components/comments/document-comments.service';
import { MentionDirectoryService } from '../../components/comments/mention-directory.service';
import { BlockCommentThreadComponent } from './block-comment-thread.component';

/** The key itself: the template's text is checked by its keys. */
@Pipe({ name: 'translate', standalone: true })
class KeyPipe implements PipeTransform {
	transform(key: string): string {
		return key;
	}
}

const DOCUMENT_ID = 'cccccccc-1111-4111-8111-111111111111';
const ME = 'employee-me';

const comment = (id: string, body: string, overrides: Partial<IComment> = {}): IComment =>
	({
		id,
		comment: body,
		employeeId: ME,
		createdAt: new Date(`2026-11-01T10:0${id.length % 10}:00Z`),
		...overrides
	}) as unknown as IComment;

/** A range as another client stores it for the thread `commentId` ("brown fox" in b1), and as the platform answers it. */
const storedRange = (
	commentId: string,
	position: Partial<IDocumentCommentAnchorPosition> = {}
): IDocumentCommentAnchorResolved => ({
	id: `anchor-${commentId}`,
	commentId,
	documentId: DOCUMENT_ID,
	blockId: 'b1',
	start: 10,
	end: 19,
	quote: 'brown fox',
	prefix: 'The quick ',
	suffix: ' jumps over the lazy dog.',
	relativeStart: null,
	relativeEnd: null,
	position: {
		status: DocumentCommentAnchorStatusEnum.EXACT,
		method: DocumentCommentAnchorMethodEnum.OFFSETS,
		blockId: 'b1',
		start: 10,
		end: 19,
		text: 'brown fox',
		...position
	}
});

/** The selection "brown fox" in b1, as the editor makes it. */
const SELECTION: IDocumentCommentAnchorInput = {
	blockId: 'b1',
	start: 10,
	end: 19,
	quote: 'brown fox',
	prefix: 'The quick ',
	suffix: ' jumps over the lazy dog.'
};

class CommentsStub {
	items: IComment[] = [];
	anchorItems: IDocumentCommentAnchorResolved[] = [];
	anchorsError: unknown = null;
	setAnchorError: unknown = null;
	created: Record<string, unknown>[] = [];

	getAll = jest.fn(() => of({ items: this.items, total: this.items.length }));
	anchors = jest.fn(() =>
		this.anchorsError
			? throwError(() => this.anchorsError)
			: of({ documentId: DOCUMENT_ID, revision: 3, live: false, items: this.anchorItems })
	);
	create = jest.fn((input: Record<string, unknown>) => {
		this.created.push(input);
		return of(comment(`new-${this.created.length}`, input['comment'] as string));
	});
	setAnchor = jest.fn((documentId: string, commentId: string, input: IDocumentCommentAnchorInput) =>
		this.setAnchorError ? throwError(() => this.setAnchorError) : of({ ...storedRange(commentId), ...input })
	);
	update = jest.fn((id: string, input: Record<string, unknown>) => of(comment(id, '', input as Partial<IComment>)));
}

describe('BlockCommentThreadComponent: threads made on a range of text', () => {
	let fixture: ComponentFixture<BlockCommentThreadComponent>;
	let component: BlockCommentThreadComponent;
	let comments: CommentsStub;
	let openBlocks: string[][];
	let ranges: unknown[][];

	async function render(inputs: Record<string, unknown> = {}): Promise<void> {
		fixture = TestBed.createComponent(BlockCommentThreadComponent);
		component = fixture.componentInstance;
		openBlocks = [];
		ranges = [];
		component.openBlocksChanged.subscribe((blocks) => openBlocks.push(blocks));
		// The outputs of a range rail (absent before ranges: then nothing is recorded).
		(component as unknown as Record<string, { subscribe?: (fn: (value: unknown[]) => void) => void }>)[
			'rangesChanged'
		]?.subscribe?.((value) => ranges.push(value));
		fixture.componentRef.setInput('documentId', DOCUMENT_ID);
		for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}

	const element = () => fixture.nativeElement as HTMLElement;
	const quotes = () =>
		Array.from(element().querySelectorAll<HTMLButtonElement>('.gz-block-range-quote')).map((button) => ({
			text: button.textContent?.trim(),
			disabled: button.disabled
		}));

	beforeEach(async () => {
		comments = new CommentsStub();
		comments.items = [
			comment('c1', '[[block:b1]]\nThis reads oddly'),
			comment('c2', '[[block:b1]]\nAgreed', { parentId: 'c1' } as Partial<IComment>),
			comment('c3', '[[block:b2]]\nOn the block')
		];
		comments.anchorItems = [storedRange('c1')];

		TestBed.configureTestingModule({
			imports: [BlockCommentThreadComponent],
			providers: [
				{
					provide: Store,
					useValue: {
						hasPermission: (permission: PermissionsEnum) => permission === PermissionsEnum.DOCS_READ,
						user: { employee: { id: ME } }
					}
				},
				{ provide: ToastrService, useValue: { success: jest.fn(), danger: jest.fn() } },
				{ provide: TranslateService, useValue: { instant: (key: string) => key } }
			]
		});
		TestBed.overrideComponent(BlockCommentThreadComponent, {
			set: {
				imports: [CommonModule, KeyPipe],
				schemas: [NO_ERRORS_SCHEMA],
				styleUrls: [],
				providers: [
					{ provide: DocumentCommentsService, useValue: comments },
					{ provide: MentionDirectoryService, useValue: { search: () => of([]) } }
				]
			}
		});
		await TestBed.compileComponents();
	});

	afterEach(() => {
		fixture?.destroy();
		TestBed.resetTestingModule();
	});

	it('shows a range thread made in another client on its text, and does not tint its block', async () => {
		await render();

		expect(comments.anchors).toHaveBeenCalledWith(DOCUMENT_ID);
		// The thread on b1 is lit on its text; only the thread without a range keeps its block marker.
		expect(openBlocks[openBlocks.length - 1]).toEqual(['b2']);
		expect(ranges[ranges.length - 1]).toEqual([
			{
				threadId: 'c1',
				blockId: 'b1',
				anchor: {
					blockId: 'b1',
					start: 10,
					end: 19,
					quote: 'brown fox',
					prefix: 'The quick ',
					suffix: ' jumps over the lazy dog.',
					relativeStart: null,
					relativeEnd: null
				}
			}
		]);
		expect(quotes()).toEqual([{ text: 'brown fox', disabled: false }]);
	});

	it('reads the text where the editor finds it now, and says when it fell back to its block or is gone', async () => {
		await render();
		const place = (overrides: Partial<IDocumentCommentAnchorPosition>): IDocumentCommentAnchorPosition => ({
			...storedRange('c1').position,
			...overrides
		});

		fixture.componentRef.setInput(
			'rangePlaces',
			new Map([['c1', place({ status: DocumentCommentAnchorStatusEnum.MOVED, text: 'brown  fox' })]])
		);
		fixture.detectChanges();
		expect(quotes()).toEqual([{ text: 'brown  fox', disabled: false }]);

		fixture.componentRef.setInput(
			'rangePlaces',
			new Map([
				['c1', place({ status: DocumentCommentAnchorStatusEnum.BLOCK, start: null, end: null, text: null })]
			])
		);
		fixture.detectChanges();
		expect(quotes()).toEqual([{ text: 'brown fox', disabled: true }]);
		expect(element().textContent).toContain('DOCS.COMMENTS.RANGE_ON_BLOCK');

		fixture.componentRef.setInput(
			'rangePlaces',
			new Map([
				[
					'c1',
					place({
						status: DocumentCommentAnchorStatusEnum.ORPHANED,
						blockId: null,
						start: null,
						end: null,
						text: null
					})
				]
			])
		);
		fixture.detectChanges();
		expect(element().textContent).toContain('DOCS.COMMENTS.RANGE_GONE');
	});

	it('posts a thread on the selected text and stores its range in the format every client reads', async () => {
		await render({ blockId: 'b1', range: SELECTION });
		expect(element().querySelector('.gz-block-composer-range')?.textContent).toContain('brown fox');

		component.draft = 'Should this be "red"?';
		await component.post();
		fixture.detectChanges();

		// The block's first line stays, for clients that know no ranges.
		expect(comments.created[0]['comment']).toBe('[[block:b1]]\nShould this be "red"?');
		expect(comments.setAnchor).toHaveBeenCalledWith(DOCUMENT_ID, 'new-1', SELECTION);
		expect(ranges[ranges.length - 1]).toEqual(
			expect.arrayContaining([expect.objectContaining({ threadId: 'new-1', blockId: 'b1' })])
		);
		// The composer is back to commenting on the block.
		expect(element().querySelector('.gz-block-composer-range')).toBeNull();
	});

	it('lets the person comment on the whole block instead', async () => {
		await render({ blockId: 'b1', range: SELECTION });
		(element().querySelector('.gz-block-composer-range-clear') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(element().querySelector('.gz-block-composer-range')).toBeNull();

		component.draft = 'On the block';
		await component.post();
		expect(comments.setAnchor).not.toHaveBeenCalled();
	});

	it('keeps every thread on its block on a platform without ranges, and never asks it to store one', async () => {
		comments.anchorsError = { status: 404, error: { code: 'DOCS_COLLAB_DISABLED' } };
		await render({ blockId: 'b1', range: SELECTION });

		expect(openBlocks[openBlocks.length - 1]).toEqual(['b1', 'b2']);
		expect(quotes()).toEqual([]);
		expect(element().querySelector('.gz-block-composer-range')).toBeNull();

		component.draft = 'Hello';
		await component.post();
		expect(comments.created).toHaveLength(1);
		expect(comments.setAnchor).not.toHaveBeenCalled();
	});

	it('leaves a new thread on its block when its range is refused, the comment kept', async () => {
		comments.setAnchorError = { status: 403, error: { code: 'DOCS_WRITE_FORBIDDEN' } };
		await render({ blockId: 'b1', range: SELECTION });

		component.draft = 'Viewer comment';
		await component.post();
		fixture.detectChanges();

		expect(comments.created).toHaveLength(1);
		expect(TestBed.inject(ToastrService).danger).not.toHaveBeenCalled();
		const lastRanges = ranges[ranges.length - 1] as Array<{ threadId: string }>;
		expect(lastRanges.map((range) => range.threadId)).toEqual(['c1']);
		// The new thread is on b1 as a block thread: its marker is back.
		expect([...openBlocks[openBlocks.length - 1]].sort()).toEqual(['b1', 'b2']);
	});

	it('tells the page once the selection is posted or dismissed, so a rail drawn again does not offer it', async () => {
		await render({ blockId: 'b1', range: SELECTION });
		let done = 0;
		component.rangeDone.subscribe(() => (done += 1));

		component.draft = 'First';
		await component.post();
		expect(done).toBe(1);

		fixture.componentRef.setInput('range', { ...SELECTION });
		fixture.detectChanges();
		(element().querySelector('.gz-block-composer-range-clear') as HTMLButtonElement).click();
		expect(done).toBe(2);

		// A post on the block alone has no selection to let go of.
		component.draft = 'Second';
		await component.post();
		expect(done).toBe(2);
	});

	it('keeps a range thread lit while a reply in it is open, its first comment resolved', async () => {
		comments.items = [
			comment('c1', '[[block:b1]]\nDone', { resolved: true }),
			comment('c2', '[[block:b1]]\nNot quite', { parentId: 'c1' } as Partial<IComment>)
		];
		await render();

		expect((ranges[ranges.length - 1] as Array<{ threadId: string }>).map((range) => range.threadId)).toEqual([
			'c1'
		]);
		expect(openBlocks[openBlocks.length - 1]).toEqual([]);
	});

	it('lights the thread asked for, even resolved, and shows its text in the page from its quote', async () => {
		comments.items = [
			comment('c1', '[[block:b1]]\nDone', { resolved: true }),
			comment('c3', '[[block:b2]]\nOn the block')
		];
		await render();
		expect(ranges[ranges.length - 1]).toEqual([]);

		fixture.componentRef.setInput('activeThreadId', 'c1');
		fixture.detectChanges();
		expect((ranges[ranges.length - 1] as Array<{ threadId: string }>).map((range) => range.threadId)).toEqual([
			'c1'
		]);
		expect(element().querySelector('.gz-block-comment.active')?.getAttribute('data-thread-id')).toBe('c1');

		const focused: string[] = [];
		component.rangeFocused.subscribe((threadId) => focused.push(threadId));
		(element().querySelector('.gz-block-range-quote') as HTMLButtonElement).click();
		expect(focused).toEqual(['c1']);
	});

	it('reads the ranges again for another page, and not at all once a page said it keeps none', async () => {
		comments.anchorsError = { status: 404, error: {} };
		await render();
		expect(comments.anchors).toHaveBeenCalledTimes(1);

		await component.reload();
		expect(comments.anchors).toHaveBeenCalledTimes(1);

		comments.anchorsError = null;
		fixture.componentRef.setInput('documentId', 'cccccccc-2222-4222-8222-222222222222');
		fixture.detectChanges();
		await fixture.whenStable();
		expect(comments.anchors).toHaveBeenCalledTimes(2);
	});

	const OTHER_PAGE = 'cccccccc-2222-4222-8222-222222222222';

	const switchPage = async (documentId: string) => {
		fixture.componentRef.setInput('documentId', documentId);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	it('stores the range on the page the thread was posted on, and leaves the page opened meanwhile alone', async () => {
		await render({ blockId: 'b1', range: SELECTION });
		const answer = new Subject<IComment>();
		comments.create.mockImplementationOnce((input: Record<string, unknown>) => {
			comments.created.push(input);
			return answer.asObservable();
		});
		let done = 0;
		component.rangeDone.subscribe(() => (done += 1));

		component.draft = 'On the first page';
		const posting = component.post();
		await switchPage(OTHER_PAGE);
		component.draft = 'A draft on the second page';
		answer.next(comment('new-1', '[[block:b1]]\nOn the first page'));
		answer.complete();
		await posting;

		expect(comments.created[0]['entityId']).toBe(DOCUMENT_ID);
		expect(comments.setAnchor).toHaveBeenCalledWith(DOCUMENT_ID, 'new-1', SELECTION);
		expect(component.draft).toBe('A draft on the second page');
		expect(done).toBe(0);
		const lastRanges = ranges[ranges.length - 1] as Array<{ threadId: string }>;
		expect(lastRanges.map((range) => range.threadId)).not.toContain('new-1');
	});

	it("keeps a late 404 of the page left behind from switching off the next page's ranges", async () => {
		await render();
		const late = new Subject<never>();
		comments.anchors.mockImplementationOnce(() => late.asObservable());
		// This reload is still waiting on its ranges when another page opens.
		const reloading = component.reload();
		await switchPage(OTHER_PAGE);
		late.error({ status: 404, error: { code: 'DOCS_COLLAB_DISABLED' } });
		await reloading;

		fixture.componentRef.setInput('blockId', 'b1');
		fixture.componentRef.setInput('range', SELECTION);
		fixture.detectChanges();
		expect(element().querySelector('.gz-block-composer-range')).not.toBeNull();
	});

	it('brings the thread asked for into sight once the page it came in with is loaded', async () => {
		const scrolled = jest.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true });
		try {
			await render({ activeThreadId: 'c1' });
			fixture.detectChanges();
			await fixture.whenStable();
			expect(scrolled).toHaveBeenCalled();
			expect((scrolled.mock.contexts[scrolled.mock.contexts.length - 1] as HTMLElement).dataset['threadId']).toBe(
				'c1'
			);
		} finally {
			delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
		}
	});

	it('logs a range that could not be stored for an unexpected reason, and keeps the thread on its block', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			comments.setAnchorError = { status: 500, error: {} };
			await render({ blockId: 'b1', range: SELECTION });
			component.draft = 'Server trouble';
			await component.post();
			expect(warn).toHaveBeenCalledTimes(1);
			expect(comments.created).toHaveLength(1);

			// A refusal is an answer, not a failure: nothing is logged.
			warn.mockClear();
			comments.setAnchorError = { status: 403, error: { code: 'DOCS_COMMENT_ANCHOR_FORBIDDEN' } };
			fixture.componentRef.setInput('range', { ...SELECTION });
			fixture.detectChanges();
			component.draft = 'Viewer';
			await component.post();
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	it('does not carry a selection over to the next page', async () => {
		await render({ blockId: 'b1', range: SELECTION });
		expect(element().querySelector('.gz-block-composer-range')).not.toBeNull();

		await switchPage(OTHER_PAGE);
		expect(element().querySelector('.gz-block-composer-range')).toBeNull();
	});

	it('keeps offering ranges after a 404 that names the comment, and stops after one that says there are none', async () => {
		await render({ blockId: 'b1', range: SELECTION });
		const offered = () => !!element().querySelector('.gz-block-composer-range');

		comments.setAnchorError = { status: 404, error: { code: 'DOCS_COMMENT_NOT_FOUND' } };
		component.draft = 'First';
		await component.post();
		fixture.componentRef.setInput('range', { ...SELECTION });
		fixture.detectChanges();
		expect(offered()).toBe(true);

		comments.setAnchorError = { status: 404, error: { code: 'DOCS_COLLAB_DISABLED' } };
		component.draft = 'Second';
		await component.post();
		fixture.componentRef.setInput('range', { ...SELECTION });
		fixture.detectChanges();
		expect(offered()).toBe(false);
		expect(comments.created).toHaveLength(2);
	});
});
