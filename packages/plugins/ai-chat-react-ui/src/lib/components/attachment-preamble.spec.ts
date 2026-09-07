import { buildAttachmentPreamble, parseAttachmentPreamble } from './attachment-preamble';

/**
 * The preamble is the attachment MECHANISM — the message text is what makes attachments
 * actionable and durable across turns — and the parser is what keeps that mechanism invisible
 * in the transcript. A drift between the two silently regresses the UI to showing raw preamble
 * lines in the user's bubble, which is exactly the state this pair was built to remove. So the
 * round trip is pinned, and so is the legacy wording older conversations still carry.
 */
describe('attachment preamble', () => {
	const DOC_ID = '3f8a2b1c-9d4e-4f6a-8b7c-1d2e3f4a5b6c';

	it('round-trips id and name-only attachments through build → parse', () => {
		const attachments = [
			{ documentId: DOC_ID, name: 'Q3 report.pdf' },
			{ name: 'notes.txt' }
		];
		const message = `${buildAttachmentPreamble(attachments)}\n\nWhat changed vs Q2?`;

		const parsed = parseAttachmentPreamble(message);
		expect(parsed).not.toBeNull();
		expect(parsed!.attachments).toEqual(attachments);
		expect(parsed!.text).toBe('What changed vs Q2?');
	});

	it('parses a preamble-only message to empty user text', () => {
		const message = buildAttachmentPreamble([{ documentId: DOC_ID, name: 'a.pdf' }]);
		const parsed = parseAttachmentPreamble(message);
		expect(parsed!.attachments).toHaveLength(1);
		expect(parsed!.text).toBe('');
	});

	it('parses the LEGACY name-only wording older conversations carry', () => {
		// Verbatim what earlier builds emitted — the docs_search instruction that could never
		// succeed (chat captures are not auto-indexed). Old history must still render as chips.
		const message =
			'Attached documents for this message:\n' +
			'- "scan.png" — just uploaded to Documents; find it with docs_search (processing may still be in flight).\n' +
			'\n' +
			'What does this say?';

		const parsed = parseAttachmentPreamble(message);
		expect(parsed!.attachments).toEqual([{ name: 'scan.png' }]);
		expect(parsed!.text).toBe('What does this say?');
	});

	it('keeps embedded quotes in names intact', () => {
		const name = 'the "final" draft (v2).docx';
		const message = `${buildAttachmentPreamble([{ documentId: DOC_ID, name }])}\n\nok`;
		expect(parseAttachmentPreamble(message)!.attachments[0]).toEqual({ documentId: DOC_ID, name });
	});

	it('preserves blank lines the user typed themselves', () => {
		const message = `${buildAttachmentPreamble([{ name: 'x.csv' }])}\n\n\nfirst\n\nsecond`;
		// One separator blank line belongs to the builder; everything after is the user's.
		expect(parseAttachmentPreamble(message)!.text).toBe('\nfirst\n\nsecond');
	});

	it('returns null for plain text, even when it merely resembles a preamble', () => {
		expect(parseAttachmentPreamble('What changed vs Q2?')).toBeNull();
		// Header with no attachment line after it is not a preamble.
		expect(parseAttachmentPreamble('Attached documents for this message:\nnothing here')).toBeNull();
		// Header must be the FIRST line.
		expect(parseAttachmentPreamble('intro\nAttached documents for this message:\n- "a" — attached to this conversation.')).toBeNull();
	});

	it('round-trips a PAGE document with its kind, so history chips link to the page route', () => {
		const attachments = [{ documentId: DOC_ID, name: 'Handbook', kind: 'PAGE' as const }];
		const message = `${buildAttachmentPreamble(attachments)}\n\nSummarize it.`;

		const parsed = parseAttachmentPreamble(message);
		expect(parsed!.attachments).toEqual(attachments);
	});

	it('flattens line breaks in names so they cannot fabricate preamble lines', () => {
		// A name with \n would break the one-attachment-per-line format: the parser stops early and
		// the transcript falls back to showing the raw preamble.
		const message = `${buildAttachmentPreamble([
			{ documentId: DOC_ID, name: 'annual\r\n  report.pdf' }
		])}\n\nthoughts?`;

		const parsed = parseAttachmentPreamble(message);
		expect(parsed!.attachments).toEqual([{ documentId: DOC_ID, name: 'annual report.pdf' }]);
		expect(parsed!.text).toBe('thoughts?');
	});

	it('parses quote-heavy hostile lines correctly (the parser is single-pass, not backtracking)', () => {
		// CodeQL flagged the previous regex parser as polynomial on exactly this shape: many
		// repetitions of `a" — ` inside an attachment line. The line is still a VALID name-only
		// attachment (longest-name semantics), and parsing it must be linear work.
		const hostile = `- "${'a" — '.repeat(500)}tail" — attached to this conversation.`;
		const parsed = parseAttachmentPreamble(`Attached documents for this message:\n${hostile}`);
		expect(parsed!.attachments).toHaveLength(1);
		expect(parsed!.attachments[0].name.endsWith('tail')).toBe(true);
	});

	it('emits no docs_search instruction for name-only attachments', () => {
		// The old wording sent the assistant to a tool that cannot find chat captures (they are
		// never auto-indexed) and does not even exist on installs where the name-only path runs.
		expect(buildAttachmentPreamble([{ name: 'a.bin' }])).not.toContain('docs_search');
	});

	it('builds an empty string for no attachments', () => {
		expect(buildAttachmentPreamble([])).toBe('');
	});
});
