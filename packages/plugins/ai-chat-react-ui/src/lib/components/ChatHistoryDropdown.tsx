import { useEffect, useMemo, type CSSProperties, type RefObject } from 'react';
import { chatTheme } from '../chat-theme';
import { type ChatTranslate, passthroughChatTranslate } from '../use-chat-translate';
import { type IChatHistoryItem } from './ChatHistoryPanel';

export interface ChatHistoryDropdownProps {
	items: IChatHistoryItem[];
	loading: boolean;
	activeId?: string;
	/** `t(key, fallback)` from the panel — see `useChatTranslate`. */
	translate?: ChatTranslate;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
	/** Close the dropdown (Esc, the ✕, or a press outside `dismissRoot`). */
	onClose: () => void;
	/**
	 * The element that holds BOTH the History button and this dropdown. A press outside it closes
	 * the dropdown; a press on the button is left to the button (it toggles), so it never reopens.
	 */
	dismissRoot: RefObject<HTMLElement | null>;
}

/** One date bucket: a heading and its conversations, newest first. */
interface IHistoryGroup {
	key: string;
	label: string;
	items: IChatHistoryItem[];
}

/** Local midnight of `date`, in ms — the day boundary the buckets are cut on. */
function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** First letter upper-cased in the user's locale ("today" → "Today"). */
function capitalize(text: string): string {
	return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/**
 * Bucket conversations into Today / Yesterday / one bucket per month. The labels come from the
 * browser's `Intl` formatters, so every UI language gets them without a translation key.
 */
function groupByDate(items: IChatHistoryItem[]): IHistoryGroup[] {
	const today = startOfDay(new Date());
	const dayMs = 24 * 60 * 60 * 1000;
	const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const month = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
	const groups = new Map<string, IHistoryGroup>();

	const time = (item: IChatHistoryItem) => new Date(item.updatedAt).getTime() || 0;
	const sorted = [...items].sort((a, b) => time(b) - time(a));
	for (const item of sorted) {
		const updated = new Date(item.updatedAt);
		const day = startOfDay(updated);
		let key: string;
		let label: string;
		if (Number.isNaN(day)) {
			key = 'undated';
			label = '';
		} else if (day >= today) {
			key = 'today';
			label = capitalize(relative.format(0, 'day'));
		} else if (day >= today - dayMs) {
			key = 'yesterday';
			label = capitalize(relative.format(-1, 'day'));
		} else {
			key = `${updated.getFullYear()}-${updated.getMonth()}`;
			label = capitalize(month.format(updated));
		}
		const group = groups.get(key) ?? { key, label, items: [] };
		group.items.push(item);
		groups.set(key, group);
	}
	return [...groups.values()];
}

/** Time of day for today and yesterday, a short date otherwise. */
function formatWhen(value: string, groupKey: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return groupKey === 'today' || groupKey === 'yesterday'
		? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
		: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Hover / focus / entrance states the inline styles cannot express. */
const dropdownCss = `
	@keyframes gzHistoryIn {
		from { opacity: 0; transform: translateY(-4px) scale(0.98); }
		to { opacity: 1; transform: none; }
	}
	.gz-ai-history-dropdown { animation: gzHistoryIn 0.14s ease-out both; transform-origin: top right; }
	.gz-ai-history-row { transition: background-color ${chatTheme.transitionSpeed} ease; }
	.gz-ai-history-row:hover,
	.gz-ai-history-row:focus-within { background-color: color-mix(in srgb, currentColor 7%, transparent); }
	.gz-ai-history-row[data-active='true'] { background-color: ${chatTheme.accentLight}; }
	.gz-ai-history-select:focus-visible,
	.gz-ai-history-delete:focus-visible {
		outline: 2px solid rgba(51, 102, 255, 0.6);
		outline-offset: -2px;
		border-radius: 8px;
	}
	.gz-ai-history-delete {
		opacity: 0;
		transition: opacity ${chatTheme.transitionSpeed} ease, color ${chatTheme.transitionSpeed} ease,
			background-color ${chatTheme.transitionSpeed} ease;
	}
	.gz-ai-history-row:hover .gz-ai-history-delete,
	.gz-ai-history-row:focus-within .gz-ai-history-delete { opacity: 1; }
	.gz-ai-history-delete:hover {
		color: ${chatTheme.red} !important;
		background-color: rgba(255, 61, 113, 0.1) !important;
	}
	@media (hover: none) { .gz-ai-history-delete { opacity: 1; } }
	@media (prefers-reduced-motion: reduce) { .gz-ai-history-dropdown { animation: none; } }
`;

/**
 * ChatHistoryDropdown
 *
 * The saved conversations as a dropdown at the right of the header, opened by its History button
 * and kept clear of the conversation column — the full-page chat's
 * version of {@link ChatHistoryPanel}, which covers the whole chat body: the right fit for the
 * narrow docked panel, a wall of empty space on a full screen. Grouped by date, newest first; the
 * open conversation is highlighted; the delete control shows on hover or keyboard focus (always on
 * touch screens).
 */
export function ChatHistoryDropdown({
	items,
	loading,
	activeId,
	translate: t = passthroughChatTranslate,
	onSelect,
	onDelete,
	onClose,
	dismissRoot
}: ChatHistoryDropdownProps) {
	const groups = useMemo(() => groupByDate(items), [items]);

	// Esc and a press outside the button + dropdown close it, like any menu.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			// Captured and stopped here: the composer's own Esc would otherwise close the chat.
			event.stopPropagation();
			onClose();
		};
		const onPointerDown = (event: PointerEvent) => {
			const root = dismissRoot.current;
			if (root && event.target instanceof Node && !root.contains(event.target)) onClose();
		};
		document.addEventListener('keydown', onKeyDown, true);
		document.addEventListener('pointerdown', onPointerDown, true);
		return () => {
			document.removeEventListener('keydown', onKeyDown, true);
			document.removeEventListener('pointerdown', onPointerDown, true);
		};
	}, [dismissRoot, onClose]);

	const containerStyle: CSSProperties = {
		position: 'absolute',
		// Positioned against the full-page header (not the History button), level with its last
		// control: the list opens in the margin to the right of the conversation, not across it.
		top: 'calc(100% + 4px)',
		right: 16,
		zIndex: 20,
		width: 340,
		maxWidth: 'calc(100vw - 32px)',
		maxHeight: 'min(480px, 70vh)',
		display: 'flex',
		flexDirection: 'column',
		borderRadius: 12,
		border: `1px solid ${chatTheme.border}`,
		background: 'var(--gz-chat-surface, Canvas)',
		boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.12)',
		overflow: 'hidden',
		color: 'inherit',
		textAlign: 'left',
		fontWeight: 400,
		letterSpacing: 'normal',
		whiteSpace: 'normal'
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		padding: '10px 10px 10px 14px',
		borderBottom: `1px solid ${chatTheme.borderSoft}`,
		fontSize: chatTheme.fontSizeBase,
		fontWeight: chatTheme.fontWeightSemibold,
		flexShrink: 0
	};

	const groupLabelStyle: CSSProperties = {
		padding: '10px 10px 4px',
		fontSize: '0.6875rem',
		fontWeight: chatTheme.fontWeightMedium,
		color: chatTheme.textHint
	};

	const selectBtnStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		flex: 1,
		minWidth: 0,
		padding: '8px 4px 8px 10px',
		border: 'none',
		background: 'transparent',
		color: 'inherit',
		textAlign: 'left',
		cursor: 'pointer',
		fontFamily: 'inherit',
		fontSize: chatTheme.fontSizeBase
	};

	const iconBtnStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: 28,
		height: 28,
		border: 'none',
		borderRadius: 6,
		background: 'transparent',
		color: chatTheme.textHint,
		cursor: 'pointer',
		padding: 0,
		flexShrink: 0
	};

	const messageStyle: CSSProperties = {
		padding: '20px 14px',
		textAlign: 'center',
		color: chatTheme.textSecondary,
		fontSize: chatTheme.fontSizeBase
	};

	return (
		<div
			className="gz-ai-history-dropdown"
			style={containerStyle}
			role="dialog"
			aria-label={t('AI_ASSISTANT.HISTORY', 'History')}
		>
			<style>{dropdownCss}</style>

			<div style={headerStyle}>
				<svg
					width="14"
					height="14"
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
				<span style={{ flex: 1 }}>{t('AI_ASSISTANT.HISTORY', 'History')}</span>
				<button
					type="button"
					className="gz-ai-chat-head-btn"
					style={{ ...iconBtnStyle, color: chatTheme.textSecondary }}
					onClick={onClose}
					title={t('AI_ASSISTANT.HISTORY_CLOSE', 'Close history')}
					aria-label={t('AI_ASSISTANT.HISTORY_CLOSE', 'Close history')}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<div className="gz-ai-chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '2px 6px 6px' }}>
				{loading && <div style={messageStyle}>{t('AI_ASSISTANT.LOADING', 'Loading…')}</div>}
				{!loading && items.length === 0 && (
					<div style={messageStyle}>{t('AI_ASSISTANT.HISTORY_EMPTY', 'No saved conversations yet.')}</div>
				)}
				{!loading &&
					groups.map((group) => (
						<div key={group.key} role="group" aria-label={group.label || undefined}>
							{group.label && <div style={groupLabelStyle}>{group.label}</div>}
							{group.items.map((item) => (
								<div
									key={item.id}
									className="gz-ai-history-row"
									data-active={item.id === activeId}
									style={{ display: 'flex', alignItems: 'center', borderRadius: 8 }}
								>
									<button
										type="button"
										className="gz-ai-history-select"
										style={selectBtnStyle}
										onClick={() => onSelect(item.id)}
										aria-current={item.id === activeId ? 'true' : undefined}
									>
										<span
											style={{
												flex: 1,
												minWidth: 0,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap'
											}}
										>
											{item.title}
										</span>
										<span
											style={{
												flexShrink: 0,
												color: chatTheme.textHint,
												fontSize: '0.6875rem',
												fontVariantNumeric: 'tabular-nums'
											}}
										>
											{formatWhen(item.updatedAt, group.key)}
										</span>
									</button>
									<button
										type="button"
										className="gz-ai-history-delete"
										style={{ ...iconBtnStyle, marginRight: 4 }}
										title={t('AI_ASSISTANT.DELETE_CONVERSATION', 'Delete conversation')}
										aria-label={`${t('AI_ASSISTANT.DELETE_CONVERSATION', 'Delete conversation')}: ${item.title}`}
										onClick={() => onDelete(item.id)}
									>
										<svg
											width="13"
											height="13"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											aria-hidden="true"
										>
											<polyline points="3 6 5 6 21 6" />
											<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
										</svg>
									</button>
								</div>
							))}
						</div>
					))}
			</div>
		</div>
	);
}
