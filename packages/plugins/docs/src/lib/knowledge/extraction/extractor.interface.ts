/**
 * The provider contract of the Documents extraction registry.
 *
 * Extraction converts every supported input into **normalized markdown** stored on
 * `document.extractedText`. Each format ships as its own provider class registered in the
 * module; third parties add providers via `ExtractionRegistryService.register()` — the
 * registry resolves providers in registration order, first match wins.
 */

/** Context handed to an extractor run (never the raw request — extractors are pure). */
export interface IDocumentExtractionContext {
	/** Original (client) filename — used for extension hints and sheet naming. */
	filename: string;
	/** Sniffed canonical MIME of the buffer. */
	mimeType: string;
	/** Cap on the produced markdown length in characters (`GAUZY_DOCS_MAX_EXTRACTED_CHARS`). */
	maxChars?: number;
	/** P1 (M5) — request the OCR path where supported. */
	forceOcr?: boolean;
}

/** The result contract every extractor must honor (§4.1 of the AI-knowledge spec). */
export interface IDocumentExtractionResult {
	/**
	 * Normalized markdown: UTF-8, LF line endings, no NUL bytes, no leading BOM.
	 * Locator headings use the exact machine shapes `## Page N` / `## Sheet: <name>`.
	 */
	markdown: string;
	/** Optional extraction metadata persisted under `document.metadata.extraction`. */
	metadata?: {
		pageCount?: number;
		truncated?: boolean;
		warnings?: string[];
		/** Approximate word count of the produced markdown. */
		wordCount?: number;
	};
}

/**
 * A single extraction provider. `supports` is consulted by the registry in provider
 * order; `extract` throws `DocsPermanentError` for corrupt/unsupported inputs and
 * `DocsTransientError` for retryable failures.
 */
export interface IDocumentExtractor {
	supports(mime: string, filename: string): boolean;
	extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult>;
}

/** NUL, as a code unit rather than a literal control character inside a pattern. */
const NUL = String.fromCharCode(0);

/**
 * Drops trailing spaces and tabs from every line.
 *
 * Deliberately NOT `/[ \t]+$/gm`: that pattern restarts the trailing-run match at every
 * position inside a run of spaces, which makes it quadratic in the length of the run.
 * This normalizer runs over UNTRUSTED extracted document text on the request thread, so a
 * single long line of spaces in an uploaded file was enough to stall it (~19s for an 80 KB
 * run, measured locally). Splitting on newlines and walking each line backwards touches
 * every character at most twice.
 *
 * Only spaces and tabs are removed - `String.prototype.trimEnd` would additionally strip
 * vertical tab, form feed and Unicode spaces, which the original pattern preserved.
 */
function trimTrailingSpacesAndTabs(text: string): string {
	return text
		.split('\n')
		.map((line) => {
			let end = line.length;
			while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
			return end === line.length ? line : line.slice(0, end);
		})
		.join('\n');
}

/**
 * Shared markdown normalization every extractor applies before returning: strips NUL
 * bytes and a leading BOM, converts CRLF/CR to LF, and trims trailing whitespace lines.
 */
export function normalizeMarkdown(markdown: string): string {
	const normalized = (markdown ?? '')
		.replace(/^\uFEFF/, '')
		.split(NUL)
		.join('')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');
	return trimTrailingSpacesAndTabs(normalized).trim();
}

/**
 * Applies the extracted-markdown size cap: truncates at the last line boundary before
 * `maxChars` and appends the honest truncation note (§4.2).
 */
export function capMarkdown(markdown: string, maxChars?: number): { markdown: string; truncated: boolean } {
	if (!maxChars || markdown.length <= maxChars) {
		return { markdown, truncated: false };
	}
	const slice = markdown.slice(0, maxChars);
	const lastLineBreak = slice.lastIndexOf('\n');
	const cut = lastLineBreak > 0 ? slice.slice(0, lastLineBreak) : slice;
	return {
		markdown: `${cut}\n\n_Truncated: the extracted text exceeded the configured size limit._`,
		truncated: true
	};
}

/**
 * Approximate word count of a markdown string (whitespace-delimited tokens).
 */
export function countWords(markdown: string): number {
	if (!markdown) {
		return 0;
	}
	const matches = markdown.match(/\S+/g);
	return matches ? matches.length : 0;
}

/**
 * Escapes a cell value for a GitHub-style pipe table: pipes and newlines neutralized.
 */
export function escapeTableCell(value: string): string {
	return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}
