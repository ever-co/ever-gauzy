import { type CSSProperties } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';

/** One conversation row as returned by GET /api/ai-chat/conversations. */
export interface IChatHistoryItem {
	id: string;
	title: string;
	updatedAt: string;
}

export interface ChatHistoryPanelProps {
	items: IChatHistoryItem[];
	loading: boolean;
	activeId?: string;
	/** `t(key, fallback)` from the panel — see `useChatTranslate`. */
	translate?: ChatTranslate;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
	onClose: () => void;
}

/**
 * ChatHistoryPanel
 *
 * Overlay list of the user's saved conversations (server-side history,
 * scoped to the current user + tenant). Click to resume, trash to delete.
 */
export function ChatHistoryPanel({
	items,
	loading,
	activeId,
	translate: t = passthroughChatTranslate,
	onSelect,
	onDelete,
	onClose
}: ChatHistoryPanelProps) {
	const containerStyle: CSSProperties = {
		position: 'absolute',
		inset: 0,
		display: 'flex',
		flexDirection: 'column',
		zIndex: 5,
		backdropFilter: 'blur(2px)',
		background: 'inherit'
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		padding: '8px 12px',
		borderBottom: `1px solid ${chatTheme.border}`,
		fontWeight: 600,
		fontSize: chatTheme.fontSizeBase,
		flexShrink: 0
	};

	const listStyle: CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		padding: 6
	};

	const rowStyle = (active: boolean): CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		width: '100%',
		borderRadius: 8,
		backgroundColor: active ? chatTheme.accentLight : 'transparent'
	});

	const selectBtnStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 6,
		flex: 1,
		minWidth: 0,
		padding: '8px 10px',
		borderRadius: 8,
		border: 'none',
		textAlign: 'left',
		cursor: 'pointer',
		backgroundColor: 'transparent',
		color: 'inherit',
		fontSize: chatTheme.fontSizeBase
	};

	const deleteBtnStyle: CSSProperties = {
		border: 'none',
		background: 'transparent',
		color: chatTheme.textHint,
		cursor: 'pointer',
		padding: 4,
		borderRadius: 4,
		flexShrink: 0
	};

	const closeBtnStyle: CSSProperties = {
		marginLeft: 'auto',
		border: 'none',
		background: 'transparent',
		color: chatTheme.textSecondary,
		cursor: 'pointer',
		padding: 4,
		borderRadius: 6,
		lineHeight: 1
	};

	return (
		<div style={containerStyle}>
			<div style={headerStyle}>
				{/* A clock glyph in front of the word, matching the header control
				    that opened this overlay, so the two read as the same thing. */}
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					style={{ flexShrink: 0, opacity: 0.7 }}
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
				</svg>
				<span>{t('AI_ASSISTANT.HISTORY', 'History')}</span>
				<button
					type="button"
					className="gz-ai-chat-head-btn"
					style={closeBtnStyle}
					onClick={onClose}
					title={t('AI_ASSISTANT.HISTORY_CLOSE', 'Close history')}
					aria-label={t('AI_ASSISTANT.HISTORY_CLOSE', 'Close history')}
				>
					✕
				</button>
			</div>

			<div style={listStyle}>
				{loading && (
					<div style={{ padding: 12, color: chatTheme.textSecondary }}>
						{t('AI_ASSISTANT.LOADING', 'Loading…')}
					</div>
				)}
				{!loading && items.length === 0 && (
					<div style={{ padding: 12, color: chatTheme.textSecondary }}>
						{t('AI_ASSISTANT.HISTORY_EMPTY', 'No saved conversations yet.')}
					</div>
				)}
				{items.map((item) => (
					<div key={item.id} style={rowStyle(item.id === activeId)}>
						<button type="button" style={selectBtnStyle} onClick={() => onSelect(item.id)}>
							<span
								style={{
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
									flex: 1
								}}
							>
								{item.title}
							</span>
							<span style={{ color: chatTheme.textHint, fontSize: '0.625rem', flexShrink: 0 }}>
								{new Date(item.updatedAt).toLocaleDateString()}
							</span>
						</button>
						<button
							type="button"
							className="gz-ai-chat-head-btn"
							style={deleteBtnStyle}
							title={t('AI_ASSISTANT.DELETE_CONVERSATION', 'Delete conversation')}
							aria-label={`${t('AI_ASSISTANT.DELETE_CONVERSATION', 'Delete conversation')}: ${item.title}`}
							onClick={() => onDelete(item.id)}
						>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							>
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
