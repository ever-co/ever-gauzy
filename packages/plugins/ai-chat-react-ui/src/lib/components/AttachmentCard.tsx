import { useEffect, useState, type CSSProperties } from 'react';
import { chatTheme } from '../chat-theme';
import type { IPreviewableAttachment } from './AttachmentPreview';

/** Card height — one line of name over one line of details, or a square image thumbnail. */
const CARD_HEIGHT = 46;

export interface AttachmentCardProps {
	attachment: IPreviewableAttachment;
	/** Open the preview. Absent → the card is not interactive. */
	onOpen?: () => void;
	/** Remove the attachment (composer only). Shown as a corner ✕ on hover / focus. */
	onRemove?: () => void;
	/** Placeholder card while a file is still uploading. */
	pending?: boolean;
	/** `t(key, fallback)` from the panel. */
	translate?: (key: string, fallback: string) => string;
}

const extensionOf = (name: string): string => {
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

const isImage = (attachment: IPreviewableAttachment): boolean =>
	Boolean(attachment.file?.type.startsWith('image/')) ||
	(!attachment.file && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extensionOf(attachment.name)));

/** `1.4 MB`, `820 KB`, `312 B`. */
export function formatAttachmentSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The short type badge on a file card: `PDF`, `DOCX`, `PAGE`, `FILE`. */
function typeBadge(attachment: IPreviewableAttachment): string {
	if (attachment.kind === 'PAGE') return 'PAGE';
	const ext = extensionOf(attachment.file?.name ?? attachment.name);
	return ext && ext.length <= 4 ? ext.toUpperCase() : 'FILE';
}

/**
 * AttachmentCard
 *
 * One attachment, shown the way Claude shows them: an image as a square thumbnail, anything else
 * as a compact card — a type badge, the name, and the size (or "Document" / "Page" for a library
 * pick, whose size is not known yet). The whole card opens the preview; in the composer a small
 * ✕ appears in the corner on hover or keyboard focus to remove it.
 */
export function AttachmentCard({ attachment, onOpen, onRemove, pending = false, translate }: AttachmentCardProps) {
	const t = translate ?? ((_key: string, fallback: string) => fallback);
	const image = !pending && isImage(attachment);

	// A thumbnail needs the bytes in memory; a library image without them falls back to the card.
	const [thumbnail, setThumbnail] = useState<string | null>(null);
	useEffect(() => {
		if (!image || !attachment.file) return;
		const url = URL.createObjectURL(attachment.file);
		setThumbnail(url);
		return () => {
			URL.revokeObjectURL(url);
			setThumbnail(null);
		};
	}, [image, attachment.file]);

	const details = pending
		? t('AI_ASSISTANT.ATTACH_UPLOADING', 'Uploading…')
		: attachment.file
			? formatAttachmentSize(attachment.file.size)
			: attachment.kind === 'PAGE'
				? t('AI_ASSISTANT.PREVIEW_PAGE', 'Page')
				: t('AI_ASSISTANT.ATTACH_DOCUMENT', 'Document');

	const cardStyle: CSSProperties = {
		position: 'relative',
		display: 'inline-flex',
		alignItems: 'center',
		gap: 8,
		height: CARD_HEIGHT,
		maxWidth: 200,
		minWidth: 0,
		flexShrink: 0,
		boxSizing: 'border-box',
		padding: thumbnail ? 0 : '0 10px 0 6px',
		width: thumbnail ? CARD_HEIGHT : undefined,
		borderRadius: 10,
		border: `1px solid ${chatTheme.border}`,
		backgroundColor: chatTheme.surface,
		color: chatTheme.textPrimary,
		textAlign: 'left',
		font: 'inherit',
		cursor: onOpen && !pending ? 'pointer' : 'default',
		overflow: 'visible'
	};

	const badgeStyle: CSSProperties = {
		width: 32,
		height: 32,
		flexShrink: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 7,
		backgroundColor: chatTheme.surfaceDeep,
		color: chatTheme.textSecondary,
		fontSize: 9,
		fontWeight: chatTheme.fontWeightSemibold,
		letterSpacing: '0.04em'
	};

	const content = thumbnail ? (
		<img
			src={thumbnail}
			alt={attachment.name}
			style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9, display: 'block' }}
		/>
	) : (
		<>
			<span aria-hidden="true" style={badgeStyle}>
				{pending ? (
					<span
						className="gz-ai-chat-rec-spinner"
						style={{
							width: 12,
							height: 12,
							boxSizing: 'border-box',
							borderRadius: '50%',
							border: `1.5px solid ${chatTheme.border}`,
							borderTopColor: chatTheme.accent,
							display: 'inline-block'
						}}
					/>
				) : (
					typeBadge(attachment)
				)}
			</span>
			<span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
				<span
					style={{
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap',
						fontSize: chatTheme.fontSizeSmall,
						fontWeight: chatTheme.fontWeightMedium,
						lineHeight: 1.3
					}}
				>
					{attachment.name}
				</span>
				<span style={{ fontSize: chatTheme.fontSizeMessage, color: chatTheme.textSecondary, lineHeight: 1.3 }}>
					{details}
				</span>
			</span>
		</>
	);

	return (
		<span className="gz-ai-chat-attachment" style={{ position: 'relative', display: 'inline-flex', minWidth: 0 }}>
			{onOpen && !pending ? (
				<button
					type="button"
					className="gz-ai-chat-attachment-card"
					onClick={onOpen}
					title={`${t('AI_ASSISTANT.PREVIEW', 'Preview')}: ${attachment.name}`}
					style={cardStyle}
				>
					{content}
				</button>
			) : (
				<span style={cardStyle} title={attachment.name}>
					{content}
				</span>
			)}

			{onRemove && !pending && (
				<button
					type="button"
					className="gz-ai-chat-attachment-remove"
					onClick={onRemove}
					title={t('AI_ASSISTANT.ATTACH_REMOVE', 'Remove attachment')}
					aria-label={`${t('AI_ASSISTANT.ATTACH_REMOVE', 'Remove attachment')}: ${attachment.name}`}
					style={{
						position: 'absolute',
						top: -6,
						right: -6,
						width: 18,
						height: 18,
						padding: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: '50%',
						border: `1px solid ${chatTheme.border}`,
						backgroundColor: 'var(--gz-chat-surface, #1f1f22)',
						color: chatTheme.textSecondary,
						cursor: 'pointer',
						zIndex: 1
					}}
				>
					<svg
						width="9"
						height="9"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			)}
		</span>
	);
}
