import { type CSSProperties, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { playgroundTheme as t } from '../../playground-theme';
import { MarkdownContent } from '../MarkdownContent';
import { ToolCallCard } from '../ToolCallCard';

export interface PlaygroundChatMessageProps {
	/** UI message (AI SDK 7) whose `parts` are rendered. */
	message: UIMessage;
	/** True while this (assistant) message is still streaming in. */
	isStreaming?: boolean;
	/** Custom avatar node (defaults to "U" / "AI" initials). */
	avatar?: ReactNode;
	/** Respond to a pending tool approval request. */
	onApprovalResponse?: (approvalId: string, approved: boolean) => void;
}

/**
 * PlaygroundChatMessage — a single message for user or assistant in the
 * playground chat panel, rendered from the message `parts`:
 * - text parts → markdown bubbles (assistant) / plain bubbles (user)
 * - tool parts (`tool-*` / `dynamic-tool`) → {@link ToolCallCard} chips
 *
 * User messages are right-aligned, assistant messages left-aligned.
 */
export function PlaygroundChatMessage({ message, isStreaming, avatar, onApprovalResponse }: PlaygroundChatMessageProps) {
	const isUser = message.role === 'user';
	const defaultInitial = isUser ? 'U' : 'AI';

	const containerStyle: CSSProperties = {
		display: 'flex',
		gap: '0.75rem',
		padding: '0.75rem 1rem',
		flexDirection: isUser ? 'row-reverse' : 'row',
		alignItems: 'flex-start'
	};

	const avatarStyle: CSSProperties = {
		width: '1.75rem',
		height: '1.75rem',
		borderRadius: '50%',
		background: isUser ? t.accent : t.textSecondary,
		color: '#fff',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		fontSize: t.fontSizeXs,
		fontWeight: 700,
		flexShrink: 0,
		userSelect: 'none'
	};

	const columnStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		alignItems: isUser ? 'flex-end' : 'flex-start',
		gap: '0.375rem',
		minWidth: 0,
		maxWidth: '80%'
	};

	const bubbleStyle: CSSProperties = {
		padding: '0.625rem 0.875rem',
		borderRadius: t.radiusLg,
		background: isUser ? t.accent : t.bgInput,
		color: isUser ? '#fff' : t.textPrimary,
		fontSize: t.fontSizeBase,
		lineHeight: 1.55,
		wordBreak: 'break-word'
	};

	return (
		<div style={containerStyle}>
			<div style={avatarStyle}>{avatar ?? defaultInitial}</div>
			<div style={columnStyle}>
				{message.parts.map((part, index) => {
					if (part.type === 'text') {
						if (!part.text) return null;
						return (
							<div style={bubbleStyle} key={`${message.id}-${index}`}>
								{isUser ? (
									<span style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>
								) : (
									<MarkdownContent content={part.text} isStreaming={isStreaming} />
								)}
							</div>
						);
					}

					if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
						const toolPart = part as unknown as {
							toolName?: string;
							state?: string;
							input?: unknown;
							output?: unknown;
							errorText?: string;
							approval?: { id?: string; approvalId?: string };
							approvalId?: string;
						};
						const toolName: string =
							part.type === 'dynamic-tool' ? toolPart.toolName ?? 'tool' : part.type.slice(5);
						const approvalId: string | undefined =
							toolPart.approval?.id ?? toolPart.approvalId ?? toolPart.approval?.approvalId;
						return (
							<div key={`${message.id}-${index}`} style={{ alignSelf: 'stretch' }}>
								<ToolCallCard
									toolName={toolName}
									state={toolPart.state ?? ''}
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
							</div>
						);
					}

					return null;
				})}
			</div>
		</div>
	);
}
