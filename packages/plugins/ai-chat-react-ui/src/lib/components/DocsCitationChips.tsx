import { type CSSProperties } from 'react';
import {
	citationLabel,
	selectCitations,
	type CitationTranslate,
	type IDocsCitation,
	type IDocsCitationsData
} from '../docs-citations.model';
import { chatTheme } from '../chat-theme';

/** Used when the panel renders these chips outside its translator (harnesses, tests). */
const passthrough: CitationTranslate = (_key, fallback) => fallback;

// Re-exported so consumers keep importing the citation surface from one place.
export {
	citationLabel,
	selectCitations,
	DOCS_CITATIONS_PART_TYPE,
	MAX_CHIPS,
	type CitationTranslate,
	type IDocsCitation,
	type IDocsCitationsData
} from '../docs-citations.model';

export interface DocsCitationChipsProps {
	data: IDocsCitationsData;
	/** Opens one citation in the app (router navigation supplied by the panel). */
	onOpen?: (citation: IDocsCitation) => void;
	/** `t(key, fallback)` from the panel; omitted in the presentational harnesses. */
	translate?: CitationTranslate;
}

/**
 * DocsCitationChips
 *
 * Renders the sources behind an assistant answer as compact, clickable chips reading
 * `{name} · {heading} · p.{page}`, each deep-linking into the Documents hub.
 *
 * Why a data part rather than the tool result: the tool's return value goes to the MODEL, which
 * is free to paraphrase or invent a link. These chips are built from what retrieval actually
 * returned in the user's own RBAC scope, so a chip can never point at a document the user was
 * not allowed to see.
 */
export function DocsCitationChips({ data, onOpen, translate }: DocsCitationChipsProps) {
	const t = translate ?? passthrough;
	const citations = selectCitations(data?.citations ?? []);
	if (!citations.length) return null;

	const wrapStyle: CSSProperties = {
		display: 'flex',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: 4,
		margin: '4px 0',
		animation: 'fadeIn 0.2s ease'
	};

	const labelStyle: CSSProperties = {
		fontSize: chatTheme.fontSizeMessage,
		fontWeight: chatTheme.fontWeightMedium,
		letterSpacing: '0.02em',
		textTransform: 'uppercase',
		color: chatTheme.textHint,
		marginRight: 2
	};

	const chipStyle: CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 4,
		maxWidth: '100%',
		padding: '3px 8px',
		borderRadius: 999,
		border: `1px solid ${chatTheme.border}`,
		backgroundColor: chatTheme.surface,
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeMessage,
		fontWeight: chatTheme.fontWeightMedium,
		lineHeight: 1.5,
		cursor: onOpen ? 'pointer' : 'default',
		textAlign: 'left',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	};

	return (
		<div style={wrapStyle}>
			<span style={labelStyle}>{t('AI_ASSISTANT.CITATIONS.LABEL', 'Sources:')}</span>
			{citations.map((citation, index) => {
				const label = citationLabel(citation, t);
				return (
					<button
						key={`${citation.documentId}-${citation.chunkIndex ?? index}`}
						type="button"
						style={chipStyle}
						title={label}
						aria-label={t('AI_ASSISTANT.CITATIONS.OPEN', 'Open source document') + `: ${label}`}
						onClick={() => onOpen?.(citation)}
					>
						<span aria-hidden="true">📄</span>
						<span
							style={{
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap'
							}}
						>
							{label}
						</span>
					</button>
				);
			})}
			{data?.lowConfidence && (
				<span style={labelStyle}>
					{t('AI_ASSISTANT.CITATIONS.LOW_CONFIDENCE', '(weak matches — verify before relying on these)')}
				</span>
			)}
		</div>
	);
}
