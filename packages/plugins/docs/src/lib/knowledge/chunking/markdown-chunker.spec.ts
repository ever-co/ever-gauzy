import { chunkMarkdown } from './markdown-chunker';
import { heuristicTokenCounter } from './token-counter';

/**
 * Chunker unit tests — pure, deterministic, driven by the chars/4 heuristic counter so no
 * tokenizer download/quirk can affect the assertions.
 */
describe('chunkMarkdown', () => {
	const counter = heuristicTokenCounter;

	const paragraph = (word: string, words = 40): string => Array(words).fill(word).join(' ');

	it('returns no chunks for empty input', () => {
		expect(chunkMarkdown('', { counter }).chunks).toEqual([]);
		expect(chunkMarkdown('   \n\n', { counter }).chunks).toEqual([]);
	});

	it('uses the whole-document fast path when the total fits one window', () => {
		const markdown = '# Title\n\nShort document body.';
		const { chunks, tokenCounter } = chunkMarkdown(markdown, { counter });
		expect(tokenCounter).toBe('chars/4');
		expect(chunks).toHaveLength(1);
		expect(chunks[0].content).toBe(markdown);
		expect(chunks[0].chunkIndex).toBe(0);
		expect(chunks[0].metadata.charRange).toEqual({ start: 0, end: markdown.length });
	});

	it('tracks nested heading paths (H2/H3) on the anchor block', () => {
		const markdown = [
			'## Contract terms',
			'',
			paragraph('alpha', 300),
			'',
			'### Termination',
			'',
			paragraph('bravo', 300)
		].join('\n');

		const { chunks } = chunkMarkdown(markdown, { counter, chunkTokens: 128, overlapTokens: 8 });
		expect(chunks.length).toBeGreaterThan(1);

		const first = chunks[0];
		expect(first.metadata.headingPath).toEqual(['Contract terms']);

		const termination = chunks.find((chunk) => chunk.metadata.headingPath.includes('Termination'));
		expect(termination).toBeDefined();
		expect(termination!.metadata.headingPath).toEqual(['Contract terms', 'Termination']);
	});

	it('pops the heading stack when a same-level heading follows', () => {
		const markdown = [
			'## First',
			'',
			paragraph('one', 200),
			'',
			'## Second',
			'',
			paragraph('two', 200)
		].join('\n');
		const { chunks } = chunkMarkdown(markdown, { counter, chunkTokens: 128, overlapTokens: 0 });
		const second = chunks.find((chunk) => chunk.metadata.headingPath.includes('Second'));
		expect(second!.metadata.headingPath).toEqual(['Second']);
	});

	it('recognizes locator headings, sets page/sheet, and excludes them from headingPath', () => {
		const markdown = [
			'## Page 1',
			'',
			paragraph('intro', 200),
			'',
			'## Page 2',
			'',
			'## Definitions',
			'',
			paragraph('body', 200),
			'',
			'## Sheet: Budget',
			'',
			paragraph('rows', 200)
		].join('\n');

		const { chunks } = chunkMarkdown(markdown, { counter, chunkTokens: 100, overlapTokens: 0 });

		const pageOne = chunks[0];
		expect(pageOne.metadata.page).toBe(1);
		expect(pageOne.metadata.headingPath).toEqual([]);

		const definitions = chunks.find((chunk) => chunk.metadata.headingPath.includes('Definitions'));
		expect(definitions).toBeDefined();
		expect(definitions!.metadata.page).toBe(2);
		expect(definitions!.metadata.headingPath).toEqual(['Definitions']);

		const sheetChunk = chunks[chunks.length - 1];
		expect(sheetChunk.metadata.sheet).toBe('Budget');
	});

	it('carries a word-boundary overlap from the previous chunk tail', () => {
		const markdown = [paragraph('alpha', 200), '', paragraph('omega', 200)].join('\n');
		const { chunks } = chunkMarkdown(markdown, { counter, chunkTokens: 128, overlapTokens: 16 });
		expect(chunks.length).toBeGreaterThan(1);

		// The second chunk starts with overlap carried from the first chunk's tail.
		const overlapPrefix = chunks[1].content.slice(0, chunks[1].content.indexOf('\n\n'));
		expect(overlapPrefix.length).toBeGreaterThan(0);
		expect(chunks[0].content.endsWith(overlapPrefix)).toBe(true);
		// Overlap is context only: the charRange anchors past it.
		expect(chunks[1].metadata.charRange!.start).toBeGreaterThan(chunks[0].metadata.charRange!.start);
	});

	it('charRange indexes into the source markdown for every chunk', () => {
		const markdown = [paragraph('first', 150), '', paragraph('second', 150), '', paragraph('third', 150)].join('\n');
		const { chunks } = chunkMarkdown(markdown, { counter, chunkTokens: 100, overlapTokens: 8 });
		for (const chunk of chunks) {
			const { start, end } = chunk.metadata.charRange!;
			const slice = markdown.slice(start, end);
			// The chunk content ends with its anchored source slice (overlap prefix aside).
			expect(chunk.content.endsWith(slice)).toBe(true);
		}
	});

	it('splits oversized pipe tables on row boundaries repeating the header', () => {
		const header = '| Name | Amount |\n| --- | --- |';
		const rows = Array.from({ length: 120 }, (_, i) => `| item-${i} | ${i * 100} |`);
		const markdown = `## Sheet: Costs\n\n${header}\n${rows.join('\n')}`;

		const { chunks } = chunkMarkdown(markdown, { counter, chunkTokens: 100, overlapTokens: 16 });
		const tableChunks = chunks.filter((chunk) => chunk.content.startsWith('| Name | Amount |'));
		expect(tableChunks.length).toBeGreaterThan(1);
		for (const chunk of tableChunks) {
			expect(chunk.content).toContain('| --- | --- |');
			expect(chunk.metadata.sheet).toBe('Costs');
			// Table slices carry no generic overlap.
			expect(chunk.content.startsWith('| Name | Amount |')).toBe(true);
		}
	});

	it('hard-splits a single block longer than a window at line/space boundaries', () => {
		const oneBlock = paragraph('longword', 600); // no blank lines — one giant paragraph
		const { chunks } = chunkMarkdown(oneBlock, { counter, chunkTokens: 100, overlapTokens: 0 });
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.tokenCount).toBeLessThanOrEqual(100);
			// Splits land on word boundaries — no torn words.
			expect(chunk.content.startsWith(' ')).toBe(false);
			expect(chunk.content.includes('longwor ')).toBe(false);
		}
	});

	it('is deterministic — identical input produces byte-identical chunks', () => {
		const markdown = ['## A', '', paragraph('x', 300), '', '### B', '', paragraph('y', 300)].join('\n');
		const a = chunkMarkdown(markdown, { counter, chunkTokens: 128, overlapTokens: 16 });
		const b = chunkMarkdown(markdown, { counter, chunkTokens: 128, overlapTokens: 16 });
		expect(a).toEqual(b);
	});
});
