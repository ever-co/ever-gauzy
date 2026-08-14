import { type CSSProperties } from 'react';
import type { UIMessage } from 'ai';
import { MarkdownContent } from './MarkdownContent';
import { ToolCallCard } from './ToolCallCard';
import {
	DocsCitationChips,
	DOCS_CITATIONS_PART_TYPE,
	type IDocsCitation,
	type IDocsCitationsData
} from './DocsCitationChips';
import { parseAttachmentPreamble, type IStagedAttachment } from './attachment-preamble';
import { chatTheme } from '../chat-theme';

/**
 * The attachment chips shown on a USER message in place of the raw preamble text.
 *
 * A chip with a `documentId` deep-links into the Documents hub through the same bridge the
 * assistant's citation chips use — and through the same shape (`IDocsCitation` is `{documentId,
 * url, …}`), so the panel's existing `onOpenCitation` handler serves both. A name-only chip
 * (Documents unavailable on this install) has nowhere to link and renders inert.
 */
function UserAttachmentChips({
	attachments,
	onOpen,
	translate
}: {
	attachments: IStagedAttachment[];
	onOpen?: (citation: IDocsCitation) => void;
	translate?: (key: string, fallback: string) => string;
}) {
	const t = translate ?? ((_key: string, fallback: string) => fallback);
	const chipStyle: CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 4,
		maxWidth: '100%',
		padding: '2px 8px',
		borderRadius: 999,
		border: '1px solid rgba(255, 255, 255, 0.35)',
		backgroundColor: 'rgba(255, 255, 255, 0.15)',
		color: 'inherit',
		fontSize: chatTheme.fontSizeSmall,
		lineHeight: 1.4,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	};
	return (
		<span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
			{attachments.map((attachment, chipIndex) =>
				attachment.documentId && onOpen ? (
					<button
						key={`${attachment.documentId}-${chipIndex}`}
						type="button"
						style={{ ...chipStyle, cursor: 'pointer', font: 'inherit', fontSize: chatTheme.fontSizeSmall }}
						title={attachment.name}
						aria-label={t('AI_ASSISTANT.ATTACH_OPEN', 'Open attached document') + `: ${attachment.name}`}
						onClick={() =>
							onOpen({
								documentId: attachment.documentId!,
								// Same deep-link split the server's citation chips use: a PAGE opens
								// at its editor route, everything else in the file browser.
								url:
									attachment.kind === 'PAGE'
										? `/pages/documents/page/${attachment.documentId}`
										: `/pages/documents?id=${attachment.documentId}`,
								name: attachment.name
							})
						}
					>
						📎 {attachment.name}
					</button>
				) : (
					<span key={`${attachment.name}-${chipIndex}`} style={chipStyle} title={attachment.name}>
						📎 {attachment.name}
					</span>
				)
			)}
		</span>
	);
}

export interface ChatMessageItemProps {
	message: UIMessage;
	/** True while this (assistant) message is still streaming. */
	isStreaming?: boolean;
	/** Respond to a pending tool approval request. */
	onApprovalResponse?: (approvalId: string, approved: boolean) => void;
	/** Open a document citation chip (router navigation supplied by the panel). */
	onOpenCitation?: (citation: IDocsCitation) => void;
	/** `t(key, fallback)` from the panel. */
	translate?: (key: string, fallback: string) => string;
}

/**
 * ChatMessageItem
 *
 * Renders one UI message from its `parts`:
 * - text parts → markdown bubbles (user: accent right, assistant: subtle left)
 * - tool parts (`tool-*` / `dynamic-tool`) → compact ToolCallCard chips with
 *   live state, expandable details and Approve/Reject when the tool awaits
 *   the user's approval.
 * - `data-docs-citations` parts (contributed by @gauzy/plugin-docs) → clickable
 *   source chips deep-linking into the Documents hub.
 * Other part kinds (step markers, reasoning) are not rendered in the
 * compact sidebar view.
 */
export function ChatMessageItem({
	message,
	isStreaming,
	onApprovalResponse,
	onOpenCitation,
	translate
}: ChatMessageItemProps) {
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
					// A user message that carries attachments starts with the preamble the panel
					// composed. The MODEL needs that text (it is what makes `docs_read` actionable
					// and keeps the attachment context alive across turns); the READER does not —
					// render chips + the user's own words instead. Display-only: the message text
					// is never altered.
					const attachmentView = isUser ? parseAttachmentPreamble(part.text) : null;
					if (attachmentView) {
						return (
							<div style={rowStyle} key={`${message.id}-${index}`}>
								<div style={{ ...bubbleStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
									<UserAttachmentChips
										attachments={attachmentView.attachments}
										{...(onOpenCitation ? { onOpen: onOpenCitation } : {})}
										{...(translate ? { translate } : {})}
									/>
									{attachmentView.text ? (
										<span style={{ whiteSpace: 'pre-wrap' }}>{attachmentView.text}</span>
									) : null}
								</div>
							</div>
						);
					}
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

				// Citation chips contributed by the Documents plugin. Rendered from the data
				// part, never from the tool result, so a chip always points at a document
				// retrieval really returned for THIS user.
				if (part.type === DOCS_CITATIONS_PART_TYPE) {
					const citationData = (part as { data?: IDocsCitationsData }).data;
					if (!citationData?.citations?.length) return null;
					return (
						<DocsCitationChips
							key={`${message.id}-${index}`}
							data={citationData}
							{...(onOpenCitation ? { onOpen: onOpenCitation } : {})}
							{...(translate ? { translate } : {})}
						/>
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
