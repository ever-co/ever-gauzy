import { useRef, useEffect, type CSSProperties } from 'react';
import type { UIMessage } from 'ai';
import { ChatMessageItem } from './ChatMessageItem';
import type { MessageFeedback } from './MessageActions';
import type { IDocsCitation } from './DocsCitationChips';
import type { IPreviewableAttachment } from './AttachmentPreview';
import { chatTheme } from '../chat-theme';

export interface ChatMessageListProps {
	messages: UIMessage[];
	/** Chat status from useChat: 'submitted' | 'streaming' | 'ready' | 'error'. */
	status: string;
	/** Respond to a pending tool approval request. */
	onApprovalResponse?: (approvalId: string, approved: boolean) => void;
	/** Open a document citation chip (router navigation supplied by the panel). */
	onOpenCitation?: (citation: IDocsCitation) => void;
	/** Preview an attachment chip on a user message (the panel's preview overlay). */
	onPreviewAttachment?: (attachment: IPreviewableAttachment) => void;
	/** The `File` uploaded this session for card `index` of message `messageId` (thumbnail, size). */
	resolveAttachmentFile?: (messageId: string, index: number) => File | undefined;
	/** `t(key, fallback)` from the panel. */
	translate?: (key: string, fallback: string) => string;
	/** Run the latest reply again. Given → each finished reply gets the action row. */
	onRegenerate?: (messageId: string) => void;
	/** Ratings given this session, by message id. */
	feedback?: Record<string, MessageFeedback>;
	/** Rate a reply (`undefined` clears it). */
	onFeedback?: (messageId: string, feedback: MessageFeedback | undefined) => void;
}

/**
 * ChatMessageList
 *
 * Scrollable container for chat messages. Auto-scrolls to
 * the bottom when new content streams in. Compact layout
 * optimised for the narrow sidebar width.
 */
export function ChatMessageList({
	messages,
	status,
	onApprovalResponse,
	onOpenCitation,
	onPreviewAttachment,
	resolveAttachmentFile,
	translate,
	onRegenerate,
	feedback,
	onFeedback
}: ChatMessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, status]);

	const containerStyle: CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		overflowX: 'hidden',
		padding: '14px 12px 12px',
		display: 'flex',
		flexDirection: 'column',
		gap: 10,
		// Wide streamed content must never stretch the panel's flex column.
		minWidth: 0
	};

	const lastMessage = messages[messages.length - 1];
	const isStreaming = status === 'streaming';
	const isBusy = status === 'submitted' || status === 'streaming';

	return (
		<div ref={scrollRef} style={containerStyle} className="gz-ai-chat-scroll gz-ai-chat-messages">
			{messages.map((message) => (
				<ChatMessageItem
					key={message.id}
					message={message}
					isStreaming={isStreaming && message === lastMessage && message.role === 'assistant'}
					onApprovalResponse={onApprovalResponse}
					onOpenCitation={onOpenCitation}
					onPreviewAttachment={onPreviewAttachment}
					resolveAttachmentFile={resolveAttachmentFile}
					translate={translate}
					{...(message.role === 'assistant' && (onRegenerate || onFeedback)
						? {
								actions: {
									busy: isBusy,
									// Regenerate belongs to the latest reply only, as in other chat apps.
									...(onRegenerate && message === lastMessage
										? { onRegenerate: () => onRegenerate(message.id) }
										: {}),
									...(onFeedback
										? {
												feedback: feedback?.[message.id],
												onFeedback: (value: MessageFeedback | undefined) =>
													onFeedback(message.id, value)
											}
										: {})
								}
							}
						: {})}
				/>
			))}

			{/* Typing indicator — model is thinking, nothing streamed yet */}
			{status === 'submitted' && lastMessage?.role === 'user' && <TypingIndicator />}
		</div>
	);
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
	// No box: the reply it stands in for has none either.
	const bubbleStyle: CSSProperties = {
		padding: '8px 0',
		display: 'inline-flex',
		alignItems: 'center',
		gap: 5,
		animation: 'fadeIn 0.2s ease'
	};

	const dotBase: CSSProperties = {
		width: 5,
		height: 5,
		borderRadius: '50%',
		backgroundColor: chatTheme.textSecondary
	};

	return (
		<div>
			<div style={bubbleStyle}>
				<span style={{ ...dotBase, animation: 'typingDot 1.4s ease-in-out infinite' }} />
				<span style={{ ...dotBase, animation: 'typingDot 1.4s ease-in-out 0.2s infinite' }} />
				<span style={{ ...dotBase, animation: 'typingDot 1.4s ease-in-out 0.4s infinite' }} />
			</div>
		</div>
	);
}
