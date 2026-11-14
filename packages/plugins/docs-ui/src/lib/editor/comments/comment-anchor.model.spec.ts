// cspell:ignore brastve
import {
	DocumentCommentAnchorMethodEnum,
	DocumentCommentAnchorStatusEnum,
	type IDocumentCommentAnchorInput,
	type IDocumentCommentAnchorResolved
} from '@gauzy/contracts';
import {
	DOCS_ANCHOR_QUOTE_MAX_LENGTH,
	anchorBlocksOf,
	anchorContextOf,
	anchorsByComment,
	approximateMatch,
	blockTextOf,
	closestRunFrom,
	commentAnchorInputOf,
	occurrencesOf,
	rangePlaceKindOf,
	resolveCommentAnchor,
	storedAnchorOf
} from './comment-anchor.model';

/**
 * The anchor rules of the Angular editor must be the platform's (`document-comment-anchor.spec.ts` in the Docs plugin)
 * and the other clients': a range made in one client is lit on the same text in another, and the rail shows what the
 * platform would. The cases below are the platform's own, plus anchors exactly as another client stores them.
 */

const paragraph = (blockId: string, ...content: object[]) => ({ type: 'paragraph', attrs: { blockId }, content });
const text = (value: string, marks?: object[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const page = (...content: object[]) => ({ type: 'doc', content });

const anchorOn = (blockText: string, quote: string, blockId = 'b1', occurrence = 0): IDocumentCommentAnchorInput => {
	const start = occurrencesOf(blockText, quote)[occurrence];
	return {
		blockId,
		start,
		end: start + quote.length,
		quote,
		...anchorContextOf(blockText, start, start + quote.length)
	};
};

describe('comment anchors (the platform rules, in the Angular editor)', () => {
	describe('blockTextOf / anchorBlocksOf', () => {
		it('joins the text nodes of a block, marks and inline atoms adding nothing', () => {
			const node = paragraph(
				'b1',
				text('Hello '),
				{ type: 'mention', attrs: { id: 'e1', label: 'Ann' } },
				text('world', [{ type: 'bold' }]),
				{ type: 'hardBreak' },
				text('!')
			);
			expect(blockTextOf(node)).toBe('Hello world!');
		});

		it('lists the blocks in document order, an outer block before the ones inside it, a copied id once', () => {
			const json = page(
				paragraph('a', text('first')),
				{
					type: 'bulletList',
					content: [{ type: 'listItem', attrs: { blockId: 'li' }, content: [paragraph('c', text('item'))] }]
				},
				paragraph('a', text('copy'))
			);
			expect(anchorBlocksOf(json)).toEqual([
				{ blockId: 'a', text: 'first' },
				{ blockId: 'li', text: 'item' },
				{ blockId: 'c', text: 'item' }
			]);
		});

		it('reads the JSON stored as text, and nothing from what is no document', () => {
			expect(anchorBlocksOf(JSON.stringify(page(paragraph('a', text('x')))))).toEqual([
				{ blockId: 'a', text: 'x' }
			]);
			expect(anchorBlocksOf('not json')).toEqual([]);
			expect(anchorBlocksOf(null)).toEqual([]);
		});
	});

	describe('resolveCommentAnchor', () => {
		const original = 'The quick brown fox jumps over the lazy dog.';

		it('keeps the offsets while they still cover the quote', () => {
			const anchor = anchorOn(original, 'brown fox');
			expect(resolveCommentAnchor(anchor, [{ blockId: 'b1', text: original }])).toEqual({
				status: DocumentCommentAnchorStatusEnum.EXACT,
				method: DocumentCommentAnchorMethodEnum.OFFSETS,
				blockId: 'b1',
				start: 10,
				end: 19,
				text: 'brown fox'
			});
		});

		it('finds the quote again in its block when text was added before it', () => {
			const anchor = anchorOn(original, 'brown fox');
			const edited = 'Well, the very quick brown fox jumps over the lazy dog.';
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b1', text: edited }]);
			expect(found.status).toBe(DocumentCommentAnchorStatusEnum.MOVED);
			expect(found.method).toBe(DocumentCommentAnchorMethodEnum.QUOTE);
			expect(edited.slice(found.start as number, found.end as number)).toBe('brown fox');
		});

		it('tells two equal quotes apart by their context', () => {
			const blockText = 'red apple, green apple, red apple again';
			const anchor = anchorOn(blockText, 'apple', 'b1', 1); // the green one
			const edited = `Fruit: ${blockText}`;
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b1', text: edited }]);
			expect(found.start).toBe(edited.indexOf('green apple') + 'green '.length);
		});

		it('follows the quote to another block when it moved there', () => {
			const anchor = anchorOn(original, 'lazy dog');
			const found = resolveCommentAnchor(anchor, [
				{ blockId: 'b1', text: 'The quick brown fox jumps.' },
				{ blockId: 'b2', text: 'Over the lazy dog.' }
			]);
			expect(found).toMatchObject({
				status: DocumentCommentAnchorStatusEnum.MOVED,
				method: DocumentCommentAnchorMethodEnum.QUOTE,
				blockId: 'b2',
				start: 9,
				end: 17
			});
		});

		it('finds the quote again approximately when a little of it was edited', () => {
			const anchor = anchorOn(original, 'jumps over the lazy');
			const edited = 'The quick brown fox jumped over the lazy dog.';
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b1', text: edited }]);
			expect(found.status).toBe(DocumentCommentAnchorStatusEnum.MOVED);
			expect(found.method).toBe(DocumentCommentAnchorMethodEnum.FUZZY);
			expect(found.text).toBe('jumped over the lazy');
		});

		it('falls back to the block when the quote is gone, and is orphaned without the block', () => {
			const anchor = anchorOn(original, 'brown fox');
			expect(resolveCommentAnchor(anchor, [{ blockId: 'b1', text: 'Completely different.' }])).toEqual({
				status: DocumentCommentAnchorStatusEnum.BLOCK,
				method: DocumentCommentAnchorMethodEnum.BLOCK,
				blockId: 'b1',
				start: null,
				end: null,
				text: null
			});
			expect(resolveCommentAnchor(anchor, [{ blockId: 'other', text: 'nothing here' }]).status).toBe(
				DocumentCommentAnchorStatusEnum.ORPHANED
			);
		});

		it('is on the block for an anchor without a quote', () => {
			const found = resolveCommentAnchor({ blockId: 'b1', start: 0, end: 0, quote: '' }, [
				{ blockId: 'b1', text: 'x' }
			]);
			expect(found.status).toBe(DocumentCommentAnchorStatusEnum.BLOCK);
		});

		it('reads the live positions first, their range kept even when its text was edited', () => {
			const anchor: IDocumentCommentAnchorInput = {
				blockId: 'b1',
				start: 6,
				end: 11,
				quote: 'brave',
				relativeStart: 'START',
				relativeEnd: 'END'
			};
			const live = (relative: string) =>
				relative === 'START'
					? { blockId: 'b1', offset: 10 }
					: relative === 'END'
						? { blockId: 'b1', offset: 17 }
						: null;
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b1', text: 'Oh, Hello brastve new world' }], live);
			expect(found).toEqual({
				status: DocumentCommentAnchorStatusEnum.MOVED,
				method: DocumentCommentAnchorMethodEnum.RELATIVE,
				blockId: 'b1',
				start: 10,
				end: 17,
				text: 'brastve'
			});
		});

		it('falls back to the offsets when a live position cannot be read', () => {
			const anchor: IDocumentCommentAnchorInput = {
				blockId: 'b2',
				start: 0,
				end: 6,
				quote: 'Second',
				relativeStart: 'AAAA',
				relativeEnd: 'AAAA'
			};
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b2', text: 'Second block' }], () => null);
			expect(found).toMatchObject({
				status: DocumentCommentAnchorStatusEnum.EXACT,
				method: DocumentCommentAnchorMethodEnum.OFFSETS
			});
		});
	});

	describe('approximateMatch', () => {
		it('finds the closest substring within a quarter of edits', () => {
			const match = approximateMatch('alpha beta gamma delta', 'betta gama');
			expect(match).not.toBeNull();
			expect('alpha beta gamma delta'.slice(match!.start, match!.end)).toBe('beta gamma');
		});

		it('refuses a match that differs too much, and quotes too short to tell', () => {
			expect(approximateMatch('alpha beta gamma', 'zzzzzzzzzz')).toBeNull();
			expect(approximateMatch('alpha beta', 'bets')).toBeNull();
		});

		it('checks the whole of a quote longer than the compared part, not only its beginning', () => {
			const quote = 'the river runs past the old mill and the green field '.repeat(8);
			const edited = `Intro. ${quote.slice(0, 300)}${quote.slice(300).replace('mill', 'mall')}`;
			expect(approximateMatch(edited, quote)).toMatchObject({ start: 7, end: 7 + quote.length, distance: 1 });
			const replaced = `Intro. ${quote.slice(0, 256)}${'x'.repeat(quote.length - 256)}`;
			expect(approximateMatch(replaced, quote)).toBeNull();
		});

		it('lets text inserted in the tail of a long quote move the end of the run', () => {
			const quote = `${'a'.repeat(256)}${'b'.repeat(72)}${'c'.repeat(72)}`;
			const edited = `${'a'.repeat(256)}${'x'.repeat(100)}${'b'.repeat(72)}${'c'.repeat(72)}`;
			expect(approximateMatch(edited, quote)).toEqual({ start: 0, end: 500, distance: 100 });
		});

		it('finds the closest run from a start, its end free within the limit', () => {
			expect(closestRunFrom('xx kitten', 3, 'sitting', 3)).toEqual({ length: 6, distance: 3 });
			expect(closestRunFrom('xx kitten', 3, 'sitting', 2)).toBeNull();
			expect(closestRunFrom('same text', 0, 'same', 0)).toEqual({ length: 4, distance: 0 });
		});

		it('stops looking once the read work budget is spent: the anchor falls back to its block', () => {
			const anchor = { blockId: 'b1', start: 0, end: 10, quote: 'betta gama' };
			const blocks = [{ blockId: 'b1', text: 'alpha beta gamma delta' }];
			const budget = { cells: 10 * blocks[0].text.length };
			expect(resolveCommentAnchor(anchor, blocks, null, budget)).toMatchObject({
				method: DocumentCommentAnchorMethodEnum.FUZZY
			});
			expect(budget.cells).toBe(0);
			expect(resolveCommentAnchor(anchor, blocks, null, budget)).toMatchObject({
				status: DocumentCommentAnchorStatusEnum.BLOCK
			});
		});
	});

	describe('commentAnchorInputOf (the anchor a selection makes)', () => {
		const blockText = 'The quick brown fox jumps over the lazy dog.';

		it('stores the block, the offsets, the quote and up to 32 characters of context', () => {
			expect(commentAnchorInputOf('b1', blockText, 10, 19)).toEqual({
				blockId: 'b1',
				start: 10,
				end: 19,
				quote: 'brown fox',
				prefix: 'The quick ',
				suffix: ' jumps over the lazy dog.'
			});
		});

		it('keeps the live ends only when the range was not cut', () => {
			const relative = { relativeStart: 'S', relativeEnd: 'E' };
			expect(commentAnchorInputOf('b1', blockText, 10, 19, relative)).toMatchObject(relative);
			const long = 'x'.repeat(DOCS_ANCHOR_QUOTE_MAX_LENGTH + 50);
			const cut = commentAnchorInputOf('b1', long, 0, long.length, relative);
			expect(cut?.quote).toHaveLength(DOCS_ANCHOR_QUOTE_MAX_LENGTH);
			expect(cut).not.toHaveProperty('relativeStart');
		});

		it('makes no anchor for an empty range (the comment is then on its block)', () => {
			expect(commentAnchorInputOf('b1', blockText, 5, 5)).toBeNull();
			expect(commentAnchorInputOf('', blockText, 0, 3)).toBeNull();
		});

		it('round-trips: an anchor made here is found exactly by the same rules', () => {
			const anchor = commentAnchorInputOf('b1', blockText, 35, 43);
			expect(resolveCommentAnchor(anchor!, [{ blockId: 'b1', text: blockText }])).toMatchObject({
				status: DocumentCommentAnchorStatusEnum.EXACT,
				text: 'lazy dog'
			});
		});
	});

	describe('an anchor made by another client (the platform stores it as sent)', () => {
		// As the platform answers `GET …/comment-anchors` for a thread made on "brown fox" in another client's editor.
		const stored: IDocumentCommentAnchorResolved = {
			id: 'anchor-1',
			commentId: 'comment-1',
			documentId: 'page-1',
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
				text: 'brown fox'
			}
		};

		it('is indexed by its comment and keeps only the stored fields', () => {
			const byComment = anchorsByComment([
				stored,
				{ ...stored, commentId: '' } as IDocumentCommentAnchorResolved
			]);
			expect([...byComment.keys()]).toEqual(['comment-1']);
			expect(storedAnchorOf(byComment.get('comment-1')!)).toEqual({
				blockId: 'b1',
				start: 10,
				end: 19,
				quote: 'brown fox',
				prefix: 'The quick ',
				suffix: ' jumps over the lazy dog.',
				relativeStart: null,
				relativeEnd: null
			});
		});

		it('is found in this editor where that client and the platform find it, after edits here', () => {
			const json = page(
				paragraph('b0', text('A new first line.')),
				paragraph(
					'b1',
					text('So: the very quick '),
					text('brown', [{ type: 'bold' }]),
					text(' fox jumps over the lazy dog.')
				)
			);
			const found = resolveCommentAnchor(storedAnchorOf(stored), anchorBlocksOf(json));
			expect(found).toMatchObject({
				status: DocumentCommentAnchorStatusEnum.MOVED,
				blockId: 'b1',
				text: 'brown fox'
			});
			expect(rangePlaceKindOf(found)).toBe('range');
		});

		it('reads as on its block, or gone, once its text is', () => {
			expect(rangePlaceKindOf(resolveCommentAnchor(stored, [{ blockId: 'b1', text: 'rewritten' }]))).toBe(
				'block'
			);
			expect(rangePlaceKindOf(resolveCommentAnchor(stored, []))).toBe('orphaned');
			expect(rangePlaceKindOf(null)).toBe('orphaned');
		});
	});
});
