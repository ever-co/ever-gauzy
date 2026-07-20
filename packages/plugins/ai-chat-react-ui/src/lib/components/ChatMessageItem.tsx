import { type CSSProperties } from 'react';
import type { UIMessage } from 'ai';
import { MarkdownContent } from './MarkdownContent';
import { ToolCallCard } from './ToolCallCard';
import { chatTheme } from '../chat-theme';

export interface ChatMessageItemProps {
	message: UIMessage;
	/** True while this (assistant) message is still streaming. */
	isStreaming?: boolean;
	/** Respond to a pending tool approval request. */
	onApprovalResponse?: (approvalId: string, approved: boolean) => void;
}

/**
 * ChatMessageItem
 *
 * Renders one UI message from its `parts`:
 * - text parts → markdown bubbles (user: accent right, assistant: subtle left)
 * - tool parts (`tool-*` / `dynamic-tool`) → compact ToolCallCard chips with
 *   live state, expandable details and Approve/Reject when the tool awaits
 *   the user's approval.
 * Other part kinds (step markers, reasoning) are not rendered in the
 * compact sidebar view.
 */
export function ChatMessageItem({ message, isStreaming, onApprovalResponse }: ChatMessageItemProps) {
	const isUser = message.role === 'user';

	const rowStyle: CSSProperties = {
		display: 'flex',
		justifyContent: isUser ? 'flex-end' : 'flex-start',
		animation: 'fadeIn 0.2s ease'
	};

	const bubbleStyle: CSSProperties = {
		maxWidth: '90%',
		padding: '8px 12px',
		borderRadius: isUser
			? `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} 4px ${chatTheme.bubbleRadius}`
			: `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} 4px`,
		backgroundColor: isUser ? chatTheme.userBubbleBg : chatTheme.assistantBubbleBg,
		color: isUser ? chatTheme.userBubbleText : chatTheme.assistantBubbleText,
		fontSize: chatTheme.fontSizeBase,
		lineHeight: 1.5,
		wordBreak: 'break-word'
	};

	return (
		<div>
			{message.parts.map((part, index) => {
				if (part.type === 'text') {
					if (!part.text) return null;
					return (
						<div style={rowStyle} key={`${message.id}-${index}`}>
							<div style={bubbleStyle}>
								{isUser ? (
									<span style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>
								) : (
									<MarkdownContent content={part.text} isStreaming={isStreaming} />
								)}
							</div>
						</div>
					);
				}

				if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
					const toolPart = part as any;
					const toolName: string = part.type === 'dynamic-tool' ? toolPart.toolName : part.type.slice(5);
					const approvalId: string | undefined =
						toolPart.approval?.id ?? toolPart.approvalId ?? toolPart.approval?.approvalId;
					return (
						<ToolCallCard
							key={`${message.id}-${index}`}
							toolName={toolName}
							state={toolPart.state}
							input={toolPart.input}
							output={toolPart.output}
							errorText={toolPart.errorText}
							{...(toolPart.state === 'approval-requested' && approvalId && onApprovalResponse
								? {
										onApprove: () => onApprovalResponse(approvalId, true),
										onReject: () => onApprovalResponse(approvalId, false)
								  }
								: {})}
						/>
					);
				}

				return null;
			})}
		</div>
	);
}
