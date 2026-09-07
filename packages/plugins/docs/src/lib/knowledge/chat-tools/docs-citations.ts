import { DocumentKindEnum, ID } from '@gauzy/contracts';

/**
 * The custom UI-message data part `docs_search` writes onto the chat stream (spec `07` §11.3,
 * `00` §6.3 R-AI-07).
 *
 * A tool's RETURN VALUE goes to the model, never to the browser in an addressable form — so the
 * clickable citation chips under an answer travel as their own `data-*` part instead. The chat
 * client renders `message.parts` of this type as chips that deep-link into the Documents hub.
 *
 * 🛑 The name is a wire contract shared with `ai-chat-react-ui`'s `DocsCitationChips`: the AI SDK
 * exposes the part client-side under exactly this `type` string. Changing it here silently stops
 * the chips from rendering — nothing else fails.
 */
export const DOCS_CITATIONS_DATA_PART = 'data-docs-citations' as const;

/** One clickable citation behind an answer. */
export interface IDocsCitation {
	/** The cited document. */
	documentId: ID;
	/** Display name, when the retrieval hit carried the document row. */
	name?: string;
	/** FILE / PAGE / FOLDER — decides the deep-link shape. */
	kind?: DocumentKindEnum | string;
	/** In-app deep link to the document (see {@link toCitationUrl}). */
	url: string;
	/** Innermost heading of the cited chunk, when the locator had one. */
	heading?: string;
	/** 1-based page of the cited chunk (paged formats only). */
	page?: number;
	/** Sheet name of the cited chunk (spreadsheets only). */
	sheet?: string;
	/** Chunk ordinal — makes two citations of the same document distinguishable. */
	chunkIndex?: number;
	/** Fused retrieval score, so the client can render the strongest hits first. */
	score?: number;
}

/** The payload of one {@link DOCS_CITATIONS_DATA_PART} part. */
export interface IDocsCitationsDataPart {
	citations: IDocsCitation[];
	/** Mirrors the tool result: the answer should be presented as possibly-related, not authoritative. */
	lowConfidence?: boolean;
}

/**
 * The in-app deep link for one document.
 *
 * Mirrors `docs-ui`'s own `DocsRowActionsService.deepLink()` — a PAGE opens in the page editor,
 * everything else opens the hub with the detail panel selected. Emitted as an app-relative path
 * so the client can hand it straight to the router (`AgentPageBridgeService.openPage`) rather
 * than reloading the SPA through an absolute URL.
 *
 * @param documentId The document to link to.
 * @param kind The document kind, when known.
 * @returns The router path, e.g. `/pages/documents?id=<uuid>`.
 */
export function toCitationUrl(documentId: ID, kind?: DocumentKindEnum | string): string {
	return kind === DocumentKindEnum.PAGE ? `/pages/documents/page/${documentId}` : `/pages/documents?id=${documentId}`;
}
