// cspell:ignore brastve
import * as Y from 'yjs';
import { DocumentCommentAnchorMethodEnum, DocumentCommentAnchorStatusEnum, IDocumentCommentAnchorInput } from '@gauzy/contracts';
import { LIVE_FRAGMENT, seedLiveDocument } from '../live/document-live.yjs';
import {
	anchorBlocksOf,
	anchorContextOf,
	approximateMatch,
	blockTextOf,
	closestRunFrom,
	liveAnchorResolverOf,
	occurrencesOf,
	resolveCommentAnchor
} from './document-comment-anchor';

const paragraph = (blockId: string, ...content: object[]) => ({ type: 'paragraph', attrs: { blockId }, content });
const text = (value: string, marks?: object[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const page = (...content: object[]) => ({ type: 'doc', content });

const anchorOn = (blockText: string, quote: string, blockId = 'b1', occurrence = 0): IDocumentCommentAnchorInput => {
	const start = occurrencesOf(blockText, quote)[occurrence];
	return { blockId, start, end: start + quote.length, quote, ...anchorContextOf(blockText, start, start + quote.length) };
};

describe('document comment anchors', () => {
	describe('blockTextOf / anchorBlocksOf', () => {
		it('joins the text nodes of a block, marks and inline atoms adding nothing', () => {
			const node = paragraph('b1', text('Hello '), { type: 'mention', attrs: { id: 'e1', label: 'Ann' } }, text('world', [{ type: 'bold' }]), { type: 'hardBreak' }, text('!'));
			expect(blockTextOf(node)).toBe('Hello world!');
		});

		it('lists the blocks in document order, an outer block before the ones inside it, a copied id once', () => {
			const json = page(
				paragraph('a', text('first')),
				{ type: 'bulletList', content: [{ type: 'listItem', attrs: { blockId: 'li' }, content: [paragraph('c', text('item'))] }] },
				paragraph('a', text('copy'))
			);
			expect(anchorBlocksOf(json)).toEqual([
				{ blockId: 'a', text: 'first' },
				{ blockId: 'li', text: 'item' },
				{ blockId: 'c', text: 'item' }
			]);
		});

		it('reads the JSON stored as text (SQLite), and nothing from what is no document', () => {
			expect(anchorBlocksOf(JSON.stringify(page(paragraph('a', text('x')))))).toEqual([{ blockId: 'a', text: 'x' }]);
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
			expect(found).toMatchObject({ status: DocumentCommentAnchorStatusEnum.MOVED, method: DocumentCommentAnchorMethodEnum.QUOTE, blockId: 'b2', start: 9, end: 17 });
		});

		it('finds the quote again approximately when a little of it was edited', () => {
			const anchor = anchorOn(original, 'jumps over the lazy');
			const edited = 'The quick brown fox jumped over the lazy dog.';
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b1', text: edited }]);
			expect(found.status).toBe(DocumentCommentAnchorStatusEnum.MOVED);
			expect(found.method).toBe(DocumentCommentAnchorMethodEnum.FUZZY);
			expect(found.text).toBe(edited.slice(found.start as number, found.end as number));
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
			expect(resolveCommentAnchor(anchor, [{ blockId: 'other', text: 'nothing here' }]).status).toBe(DocumentCommentAnchorStatusEnum.ORPHANED);
		});

		it('is on the block for an anchor without a quote', () => {
			expect(resolveCommentAnchor({ blockId: 'b1', start: 0, end: 0, quote: '' }, [{ blockId: 'b1', text: 'x' }]).status).toBe(DocumentCommentAnchorStatusEnum.BLOCK);
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
			// The beginning kept, the rest replaced: not the quote any more.
			const replaced = `Intro. ${quote.slice(0, 256)}${'x'.repeat(quote.length - 256)}`;
			expect(approximateMatch(replaced, quote)).toBeNull();
		});
	});

	describe('the work budget of a read', () => {
		it('stops looking for approximate quotes once the budget is spent: the anchor falls back to its block', () => {
			const anchor = { blockId: 'b1', start: 0, end: 10, quote: 'betta gama' };
			const blocks = [{ blockId: 'b1', text: 'alpha beta gamma delta' }];
			const budget = { cells: 10 * blocks[0].text.length };
			expect(resolveCommentAnchor(anchor, blocks, null, budget)).toMatchObject({ status: DocumentCommentAnchorStatusEnum.MOVED, method: DocumentCommentAnchorMethodEnum.FUZZY });
			expect(budget.cells).toBe(0);
			expect(resolveCommentAnchor(anchor, blocks, null, budget)).toMatchObject({ status: DocumentCommentAnchorStatusEnum.BLOCK });
			// Without a budget nothing is counted.
			expect(resolveCommentAnchor(anchor, blocks)).toMatchObject({ method: DocumentCommentAnchorMethodEnum.FUZZY });
		});
	});

	describe('long quotes', () => {
		it('lets text inserted in the tail move the end of the run', () => {
			const quote = `${'a'.repeat(256)}${'b'.repeat(72)}${'c'.repeat(72)}`;
			const text = `${'a'.repeat(256)}${'x'.repeat(100)}${'b'.repeat(72)}${'c'.repeat(72)}`;
			expect(approximateMatch(text, quote)).toEqual({ start: 0, end: 500, distance: 100 });
		});

		it('tries the next place the beginning starts when the first one is not the quote', () => {
			const quote = `${'a'.repeat(256)}${'b'.repeat(144)}`;
			const first = `${'a'.repeat(256)}${'x'.repeat(144)}`;
			const text = `${first} ${'a'.repeat(256)}${'b'.repeat(143)}c`;
			expect(approximateMatch(text, quote)).toEqual({ start: first.length + 1, end: text.length, distance: 1 });
		});

		it("admits a start whose beginning holds more than a quarter of it in edits, within the whole quote's limit", () => {
			const quote = `${'a'.repeat(256)}${'b'.repeat(744)}`;
			const text = `${'x'.repeat(65)}${'a'.repeat(191)}${'b'.repeat(744)}`;
			expect(approximateMatch(text, quote)).toMatchObject({ start: 0, end: 1000, distance: 65 });
		});

		it('finds the closest run from a start, its end free within the limit', () => {
			expect(closestRunFrom('xx kitten', 3, 'sitting', 3)).toEqual({ length: 6, distance: 3 });
			expect(closestRunFrom('xx kitten', 3, 'sitting', 2)).toBeNull();
			expect(closestRunFrom('same text', 0, 'same', 0)).toEqual({ length: 4, distance: 0 });
		});
	});

	describe('live relative positions', () => {
		const encode = (type: Y.AbstractType<any>, index: number) =>
			Buffer.from(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(type, index))).toString('base64');

		const liveFixture = () => {
			const json = page(paragraph('b1', text('Hello '), text('brave', [{ type: 'bold' }]), text(' new world')), paragraph('b2', text('Second block')));
			const doc = seedLiveDocument('00000000-0000-4000-8000-000000000001', 1, json);
			const first = doc.getXmlFragment(LIVE_FRAGMENT).get(0) as Y.XmlElement;
			const runs = first.get(0) as Y.XmlText;
			return { doc, first, runs };
		};

		it('reads a relative position as its block and the text before it', () => {
			const { doc, runs } = liveFixture();
			const resolve = liveAnchorResolverOf(doc);
			expect(resolve(encode(runs, 6))).toEqual({ blockId: 'b1', offset: 6 });
		});

		it('keeps the range of a comment over concurrent edits, its text edited included', () => {
			const { doc, runs } = liveFixture();
			const anchor: IDocumentCommentAnchorInput = {
				blockId: 'b1',
				start: 6,
				end: 11,
				quote: 'brave',
				relativeStart: encode(runs, 6),
				relativeEnd: encode(runs, 11)
			};
			// Someone types before the range, and inside it.
			runs.insert(0, 'Oh, ');
			runs.insert(4 + 9, 'st'); // "brave" -> "brastve"
			const blocks = anchorBlocksOf({ type: 'doc', content: [{ type: 'paragraph', attrs: { blockId: 'b1' }, content: [{ type: 'text', text: runs.toDelta().map((run: { insert: string }) => run.insert).join('') }] }] });
			const found = resolveCommentAnchor(anchor, blocks, liveAnchorResolverOf(doc));
			expect(found).toMatchObject({ method: DocumentCommentAnchorMethodEnum.RELATIVE, blockId: 'b1', start: 10, end: 17, text: 'brastve' });
			expect(found.status).toBe(DocumentCommentAnchorStatusEnum.MOVED);
		});

		it('answers nothing for a position the document does not know, or bytes that are none', () => {
			const { doc } = liveFixture();
			const other = new Y.Doc();
			const otherText = other.getXmlFragment(LIVE_FRAGMENT);
			const element = new Y.XmlElement('paragraph');
			otherText.insert(0, [element]);
			const resolve = liveAnchorResolverOf(doc);
			expect(resolve(encode(element, 0))).toBeNull();
			expect(resolve('not base64 at all!')).toBeNull();
			expect(resolve('')).toBeNull();
		});

		it('falls back to the quote when a live position cannot be read', () => {
			const { doc } = liveFixture();
			const anchor: IDocumentCommentAnchorInput = { blockId: 'b2', start: 0, end: 6, quote: 'Second', relativeStart: 'AAAA', relativeEnd: 'AAAA' };
			const found = resolveCommentAnchor(anchor, [{ blockId: 'b2', text: 'Second block' }], liveAnchorResolverOf(doc));
			expect(found).toMatchObject({ status: DocumentCommentAnchorStatusEnum.EXACT, method: DocumentCommentAnchorMethodEnum.OFFSETS });
		});
	});
});
