import { IComment, ID, IEmployee } from '@gauzy/contracts';
import {
	applyMentionPick,
	buildCommentThread,
	collectMentionEmployeeIds,
	commentBlockId,
	commentBody,
	detectMentionToken,
	employeeMentionLabel,
	filterMentionCandidates,
	groupCommentsByBlock,
	openBlockAnchors,
	parseBlockAnchor,
	withBlockAnchor
} from './document-comments.model';

const comment = (id: string, createdAt: string, parentId?: string): IComment =>
	({ id, createdAt: new Date(createdAt), parentId, comment: id } as unknown as IComment);

const employee = (id: string, fullName: string): IEmployee => ({ id, fullName } as unknown as IEmployee);

describe('buildCommentThread', () => {
	it('groups replies under their parent, oldest first at both levels', () => {
		const nodes = buildCommentThread([
			comment('reply-b', '2026-01-01T10:02:00Z', 'root-1'),
			comment('root-2', '2026-01-01T11:00:00Z'),
			comment('reply-a', '2026-01-01T10:01:00Z', 'root-1'),
			comment('root-1', '2026-01-01T10:00:00Z')
		]);

		expect(nodes.map((node) => node.comment.id)).toEqual(['root-1', 'root-2']);
		expect(nodes[0].replies.map((reply) => reply.id)).toEqual(['reply-a', 'reply-b']);
		expect(nodes[1].replies).toEqual([]);
	});

	it('promotes an orphaned reply to a root instead of dropping it', () => {
		// The parent FK is ON DELETE SET NULL, and a page boundary can orphan a
		// reply too — a comment that exists must render somewhere.
		const nodes = buildCommentThread([comment('orphan', '2026-01-01T10:00:00Z', 'deleted-parent')]);

		expect(nodes).toHaveLength(1);
		expect(nodes[0].comment.id).toBe('orphan');
	});

	it('returns an empty thread for an empty page', () => {
		expect(buildCommentThread([])).toEqual([]);
	});
});

describe('detectMentionToken', () => {
	it('finds the token the caret sits in', () => {
		expect(detectMentionToken('hey @jo', 7)).toEqual({ start: 4, query: 'jo' });
	});

	it('opens on an @ at the very start of the box', () => {
		expect(detectMentionToken('@a', 2)).toEqual({ start: 0, query: 'a' });
	});

	it('ignores an @ that is not at a word boundary (e-mail addresses)', () => {
		expect(detectMentionToken('write to sam@example.com', 24)).toBeNull();
	});

	it('closes once the token grows past a name or crosses a newline', () => {
		expect(detectMentionToken(`@${'x'.repeat(41)}`, 42)).toBeNull();
		expect(detectMentionToken('@jo\nmore', 8)).toBeNull();
	});

	it('returns null when there is no @ before the caret', () => {
		expect(detectMentionToken('plain text', 5)).toBeNull();
	});
});

describe('applyMentionPick', () => {
	it('replaces the token with the label and leaves the caret after the trailing space', () => {
		const applied = applyMentionPick('hey @jo, look', { start: 4, query: 'jo' }, 7, 'Jo Smith');

		expect(applied.text).toBe('hey @Jo Smith , look');
		expect(applied.caret).toBe('hey @Jo Smith '.length);
	});
});

describe('collectMentionEmployeeIds', () => {
	const picked = [
		{ id: 'e1' as ID, label: 'Jo Smith' },
		{ id: 'e2' as ID, label: 'Ann Lee' }
	];

	it('reports only the picks still present in the body', () => {
		expect(collectMentionEmployeeIds('thanks @Jo Smith', picked)).toEqual(['e1']);
	});

	it('de-duplicates a name mentioned twice', () => {
		expect(collectMentionEmployeeIds('@Jo Smith and @Jo Smith', picked)).toEqual(['e1']);
	});

	it('reports nothing when every mention was deleted again before posting', () => {
		expect(collectMentionEmployeeIds('never mind', picked)).toEqual([]);
	});
});

describe('filterMentionCandidates', () => {
	const employees = [employee('e1', 'Jo Smith'), employee('e2', 'Ann Lee'), employee('e3', 'Jo Brown')];

	it('matches labels case-insensitively', () => {
		expect(filterMentionCandidates(employees, 'jo').map((candidate) => candidate.id)).toEqual(['e1', 'e3']);
	});

	it('caps the menu', () => {
		expect(filterMentionCandidates(employees, '', 2)).toHaveLength(2);
	});
});

describe('employeeMentionLabel', () => {
	it('falls back through fullName → name parts → email → id', () => {
		expect(employeeMentionLabel(employee('e1', 'Jo Smith'))).toBe('Jo Smith');
		expect(employeeMentionLabel({ id: 'e2', user: { firstName: 'Ann', lastName: 'Lee' } } as IEmployee)).toBe(
			'Ann Lee'
		);
		expect(employeeMentionLabel({ id: 'e3', user: { email: 'a@b.c' } } as IEmployee)).toBe('a@b.c');
		expect(employeeMentionLabel({ id: 'e4' } as IEmployee)).toBe('e4');
	});
});

/**
 * Block anchoring (spec 05 §8).
 *
 * 🛑 The anchor rides in the comment body because the platform `Comment` entity has no
 * `metadata` column and its DTO whitelists unknown properties away — so the two invariants
 * worth pinning are that the marker never survives into anything a human reads, and that an
 * edit (which re-sends the whole body) cannot silently detach a comment from its block.
 */
describe('block anchors', () => {
	const anchored = (body: string, resolved = false): IComment =>
		({ id: body, comment: body, resolved, createdAt: new Date('2026-01-01T10:00:00Z') } as unknown as IComment);

	it('splits a stored body into its anchor and its text', () => {
		expect(parseBlockAnchor('[[block:abc-123]]\nLooks wrong here')).toEqual({
			blockId: 'abc-123',
			body: 'Looks wrong here'
		});
	});

	it('treats an unanchored body as document-level', () => {
		expect(parseBlockAnchor('Plain comment')).toEqual({ blockId: null, body: 'Plain comment' });
		expect(parseBlockAnchor(undefined)).toEqual({ blockId: null, body: '' });
	});

	it('only honours the marker at the very start — prose about blocks is not an anchor', () => {
		expect(commentBlockId({ comment: 'see [[block:abc]] above' } as IComment)).toBeNull();
	});

	it('never shows the marker to a reader', () => {
		expect(commentBody({ comment: '[[block:abc]]\nhello' } as IComment)).toBe('hello');
	});

	it('re-stamping an already-stripped body keeps exactly one marker', () => {
		const once = withBlockAnchor('abc', 'hello');
		const twice = withBlockAnchor('abc', withBlockAnchor('abc', 'hello'));
		expect(twice).toBe(once);
		expect(commentBody({ comment: twice } as IComment)).toBe('hello');
	});

	it('writes a plain body when there is no block to anchor to', () => {
		expect(withBlockAnchor(null, 'hello')).toBe('hello');
	});

	it('reports only anchors that still have an unresolved comment', () => {
		const open = openBlockAnchors([
			anchored('[[block:a]]\nopen'),
			anchored('[[block:b]]\ndone', true),
			anchored('no anchor')
		]);
		expect(open).toEqual(['a']);
	});

	it('groups anchored comments by block and ignores document-level ones', () => {
		const grouped = groupCommentsByBlock([
			anchored('[[block:a]]\none'),
			anchored('[[block:a]]\ntwo'),
			anchored('[[block:b]]\nthree'),
			anchored('loose')
		]);
		expect([...grouped.keys()]).toEqual(['a', 'b']);
		expect(grouped.get('a')).toHaveLength(2);
	});
});
