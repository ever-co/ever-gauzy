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
import { AttachmentCard } from './AttachmentCard';
import type { IPreviewableAttachment } from './AttachmentPreview';
import { chatTheme } from '../chat-theme';

/**
 * The attachments of a USER message, shown in place of the raw preamble text — as the same cards
 * the composer shows, in a row above the message, the way Claude shows them.
 *
 * A card opens the preview when the panel supplies one (the preview links on to Documents).
 * Without it, a card with a `documentId` deep-links into the Documents hub through the same bridge
 * the assistant's citation chips use — and through the same shape (`IDocsCitation` is
 * `{documentId, url, …}`), so the panel's existing `onOpenCitation` handler serves both. A
 * name-only card (Documents unavailable on this install) then has nowhere to go and renders inert.
 */
function UserAttachmentChips({
	attachments,
	onOpen,
	onPreview,
	resolveFile,
	translate
}: {
	attachments: IStagedAttachment[];
	onOpen?: (citation: IDocsCitation) => void;
	/** When supplied, every card opens the preview (which itself links on to Documents). */
	onPreview?: (attachment: IPreviewableAttachment) => void;
	/** The `File` uploaded this session for the card at `index` (thumbnail, size, preview). */
	resolveFile?: (index: number) => File | undefined;
	translate?: (key: string, fallback: string) => string;
}) {
	const openInDocuments = (attachment: IStagedAttachment) =>
		onOpen?.({
			documentId: attachment.documentId!,
			// Same deep-link split the server's citation chips use: a PAGE opens at its editor
			// route, everything else in the file browser.
			url:
				attachment.kind === 'PAGE'
					? `/pages/documents/page/${attachment.documentId}`
					: `/pages/documents?id=${attachment.documentId}`,
			name: attachment.name
		});
	return (
		<span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
			{attachments.map((attachment, chipIndex) => {
				// By position in THIS message — never by name, which two different files can share.
				const file = resolveFile?.(chipIndex);
				const withFile: IPreviewableAttachment = file ? { ...attachment, file } : attachment;
				return (
					<AttachmentCard
						key={`${attachment.documentId ?? attachment.name}-${chipIndex}`}
						attachment={withFile}
						translate={translate}
						onOpen={
							onPreview
								? () => onPreview(withFile)
								: attachment.documentId && onOpen
									? () => openInDocuments(attachment)
									: undefined
						}
					/>
				);
			})}
		</span>
	);
}

/**
 * True when a text part has nothing to show — empty, whitespace, or zero-width characters only.
 * Shared with the playground's message renderer.
 */
export function isBlankText(text: string | undefined): boolean {
	return !text || !text.replace(/[\s​-‍⁠﻿]/g, '');
}

export interface ChatMessageItemProps {
	message: UIMessage;
	/** True while this (assistant) message is still streaming. */
	isStreaming?: boolean;
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
	onPreviewAttachment,
	resolveAttachmentFile,
	translate
}: ChatMessageItemProps) {
	const isUser = message.role === 'user';

	const rowStyle: CSSProperties = {
		display: 'flex',
		justifyContent: isUser ? 'flex-end' : 'flex-start',
		animation: 'fadeIn 0.2s ease'
	};

	const bubbleStyle: CSSProperties = {
		maxWidth: isUser ? '88%' : '96%',
		minWidth: 0,
		padding: isUser ? '7px 11px' : '8px 11px',
		borderRadius: isUser
			? `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadiusTight} ${chatTheme.bubbleRadius}`
			: `${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadius} ${chatTheme.bubbleRadiusTight}`,
		backgroundColor: isUser ? chatTheme.userBubbleBg : chatTheme.assistantBubbleBg,
		// The assistant bubble is a quiet surface, so a hairline is what gives it an edge
		// against the panel; the user bubble already has its own fill.
		border: isUser ? '1px solid transparent' : `1px solid ${chatTheme.borderSoft}`,
		color: isUser ? chatTheme.userBubbleText : chatTheme.assistantBubbleText,
		fontSize: chatTheme.fontSizeMessage,
		lineHeight: chatTheme.lineHeightMessage,
		letterSpacing: '0.01em',
		wordBreak: 'break-word'
	};

	return (
		<div>
			{message.parts.map((part, index) => {
				if (part.type === 'text') {
					// Models often open a step with a whitespace-only text part (a bare "\n") right
					// before a tool call; rendered, it is an empty bubble above the tool card.
					if (isBlankText(part.text)) return null;
					// A user message that carries attachments starts with the preamble the panel
					// composed. The MODEL needs that text (it is what makes `docs_read` actionable
					// and keeps the attachment context alive across turns); the READER does not —
					// render chips + the user's own words instead. Display-only: the message text
					// is never altered.
					const attachmentView = isUser ? parseAttachmentPreamble(part.text) : null;
					if (attachmentView) {
						// Cards in their own row ABOVE the bubble; the bubble holds only the words.
						return (
							<div
								key={`${message.id}-${index}`}
								style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}
							>
								<UserAttachmentChips
									attachments={attachmentView.attachments}
									{...(onOpenCitation ? { onOpen: onOpenCitation } : {})}
									{...(onPreviewAttachment ? { onPreview: onPreviewAttachment } : {})}
									{...(resolveAttachmentFile
									? { resolveFile: (chipIndex: number) => resolveAttachmentFile(message.id, chipIndex) }
									: {})}
									{...(translate ? { translate } : {})}
								/>
								{attachmentView.text ? (
									<div style={bubbleStyle}>
										<span style={{ whiteSpace: 'pre-wrap' }}>{attachmentView.text}</span>
									</div>
								) : null}
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
