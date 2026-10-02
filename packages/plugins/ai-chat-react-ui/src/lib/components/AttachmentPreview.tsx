import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { chatTheme } from '../chat-theme';
import { MarkdownContent } from './MarkdownContent';
import type { IStagedAttachment } from './attachment-preamble';

/**
 * An attachment the preview can open: the staged/sent attachment, plus the picked `File` when the
 * user uploaded it in this session — that one previews instantly from memory, with no round trip.
 */
export interface IPreviewableAttachment extends IStagedAttachment {
	file?: File;
}

export interface AttachmentPreviewProps {
	attachment: IPreviewableAttachment;
	/** API origin, e.g. `environment.API_BASE_URL`. */
	apiBaseUrl: string;
	/** Auth + tenant headers (the panel builds these for every call). */
	headers: () => Record<string, string>;
	/**
	 * The selected organization (and tenant), sent as query params on the document read. The
	 * endpoint scopes by them; without them it falls back to the token's last organization, which
	 * is missing or stale after the user switches organizations — and the document then 404s.
	 */
	scope?: () => { organizationId?: string; tenantId?: string };
	/** Open the attachment in the Documents page — offered when it has a `documentId`. */
	onOpenInDocuments?: (attachment: IPreviewableAttachment) => void;
	onClose: () => void;
	/** `t(key, fallback)` from the panel. */
	translate?: (key: string, fallback: string) => string;
}

/** Largest text file read into the preview; anything bigger shows its details only. */
const MAX_TEXT_BYTES = 512 * 1024;

type PreviewView =
	| { type: 'loading' }
	// `blob` is kept for "Open in a new tab", which needs a URL of its own (see that handler).
	| { type: 'image' | 'pdf' | 'video' | 'audio'; url: string; blob: Blob }
	| { type: 'text'; text: string }
	| { type: 'markdown'; text: string }
	| { type: 'info' };

/** What the Documents API answers for one document (the slice this preview reads). */
interface IDocumentSlice {
	kind?: string;
	mimeType?: string;
	fileSize?: number;
	originalFilename?: string;
	contentHtml?: string;
	summary?: string;
}

const extensionOf = (name: string): string => name.split('.').pop()?.toLowerCase() ?? '';

/**
 * Which renderer a file gets — the same families the Documents preview modal uses, so a file
 * previews the same way in both places.
 */
function viewerFor(mime: string, name: string): 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'extracted' | 'info' {
	const type = mime.toLowerCase();
	const ext = extensionOf(name);
	if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
	if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
	if (type.startsWith('video/')) return 'video';
	if (type.startsWith('audio/')) return 'audio';
	if (
		type.startsWith('text/') ||
		type === 'application/json' ||
		['md', 'txt', 'csv', 'json', 'log', 'html', 'xml', 'yml', 'yaml'].includes(ext)
	) {
		return 'text';
	}
	if (
		['word', 'spreadsheet', 'presentation', 'opendocument', 'excel'].some((family) => type.includes(family)) ||
		['docx', 'xlsx', 'pptx', 'odt', 'ods'].includes(ext)
	) {
		return 'extracted';
	}
	return 'info';
}

/** `1.4 MB`, `820 KB`, `312 B`. */
function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined || !Number.isFinite(bytes)) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * A PAGE's stored HTML as plain text. Parsed by `DOMParser`, which never runs scripts or loads
 * resources, and read back as text — the preview never injects stored HTML.
 */
function htmlToText(html: string): string {
	if (typeof DOMParser === 'undefined') return '';
	const body = new DOMParser().parseFromString(html, 'text/html').body;
	body.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, br, tr').forEach((node) => node.append('\n'));
	return (body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * AttachmentPreview
 *
 * Opens an attachment over the chat body — the same overlay slot as the Documents picker, so the
 * panel header stays usable above it. A file uploaded in this session previews from the picked
 * `File`; a Documents attachment loads through the Documents API: the stored bytes (`/raw`) for
 * images, PDFs and media, the extracted text for text and office files, and the page text for a
 * written page. Anything that cannot render shows its name, type and size, with "Open in
 * Documents" when it lives there.
 */
export function AttachmentPreview({
	attachment,
	apiBaseUrl,
	headers,
	scope,
	onOpenInDocuments,
	onClose,
	translate
}: AttachmentPreviewProps) {
	const t = translate ?? ((_key: string, fallback: string) => fallback);
	const [view, setView] = useState<PreviewView>({ type: 'loading' });
	const [meta, setMeta] = useState<{ mime: string; size?: number }>({ mime: attachment.file?.type ?? '' });
	const closeRef = useRef<HTMLButtonElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);

	// Focus the close button, so Escape and Tab work from the moment the preview opens — and hand
	// focus back to whatever opened it (the attachment card) when it closes.
	useEffect(() => {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		closeRef.current?.focus();
		return () => {
			if (opener?.isConnected) opener.focus();
		};
	}, []);

	/** The dialog's focusable controls, in tab order (hidden ones excluded). */
	const focusableInDialog = (): HTMLElement[] => {
		const dialog = dialogRef.current;
		if (!dialog) return [];
		return Array.from(
			dialog.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, audio[controls], video[controls], [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => element.getClientRects().length > 0);
	};

	/** Keep Tab / Shift+Tab inside the dialog: it is modal, so focus must not reach the chat behind. */
	const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const focusable = focusableInDialog();
		if (!focusable.length) {
			event.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !dialog.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	};

	useEffect(() => {
		let objectUrl: string | null = null;
		const abort = new AbortController();
		const asObjectUrl = (blob: Blob) => {
			objectUrl = URL.createObjectURL(blob);
			return objectUrl;
		};

		const load = async (): Promise<PreviewView> => {
			const { file, documentId, name } = attachment;

			// Uploaded in this session: everything is already in memory.
			if (file) {
				setMeta({ mime: file.type, size: file.size });
				const viewer = viewerFor(file.type, file.name || name);
				if (viewer === 'image' || viewer === 'pdf' || viewer === 'video' || viewer === 'audio') {
					return { type: viewer, url: asObjectUrl(file), blob: file };
				}
				if (viewer === 'text' && file.size <= MAX_TEXT_BYTES) {
					const text = await file.text();
					return extensionOf(file.name) === 'md' ? { type: 'markdown', text } : { type: 'text', text };
				}
				// Office files and the rest: fall through to the Documents copy when there is one,
				// which has the extracted text the browser cannot produce.
				if (!documentId) return { type: 'info' };
			}
			if (!documentId) return { type: 'info' };

			const base = `${apiBaseUrl}/api/plugins/docs/documents/${encodeURIComponent(documentId)}`;
			// The selected organization rides on the read, as the Documents page sends it; only
			// present values are sent, never the string "undefined". `/raw` and `/extracted-text`
			// take no scope parameter on the server, so they are left as they are.
			const query = new URLSearchParams();
			const { organizationId, tenantId } = scope?.() ?? {};
			if (organizationId) query.set('organizationId', organizationId);
			if (tenantId) query.set('tenantId', tenantId);
			const search = query.toString();
			const response = await fetch(search ? `${base}?${search}` : base, {
				headers: headers(),
				signal: abort.signal
			});
			if (!response.ok) return { type: 'info' };
			const document = (await response.json()) as IDocumentSlice;
			setMeta({ mime: document.mimeType ?? file?.type ?? '', size: document.fileSize ?? file?.size });

			if (document.kind === 'PAGE') {
				const text = document.contentHtml ? htmlToText(document.contentHtml) : '';
				return text ? { type: 'text', text } : { type: 'info' };
			}

			const viewer = viewerFor(document.mimeType ?? '', document.originalFilename ?? name);
			if (viewer === 'image' || viewer === 'pdf' || viewer === 'video' || viewer === 'audio') {
				const raw = await fetch(`${base}/raw`, { headers: headers(), signal: abort.signal });
				if (!raw.ok) return { type: 'info' };
				const blob = await raw.blob();
				return { type: viewer, url: asObjectUrl(blob), blob };
			}
			if (viewer === 'text' || viewer === 'extracted') {
				const extracted = await fetch(`${base}/extracted-text`, { headers: headers(), signal: abort.signal });
				if (!extracted.ok) return { type: 'info' };
				const body = (await extracted.json()) as { extractedText?: string | null };
				const text = body.extractedText ?? '';
				if (!text.trim()) return { type: 'info' };
				// Plain text and CSV stay pre-formatted; everything else is the extracted markdown.
				const mime = (document.mimeType ?? '').toLowerCase();
				return mime === 'text/plain' || mime === 'text/csv' ? { type: 'text', text } : { type: 'markdown', text };
			}
			return { type: 'info' };
		};

		load()
			.then((next) => {
				if (!abort.signal.aborted) setView(next);
			})
			.catch(() => {
				if (!abort.signal.aborted) setView({ type: 'info' });
			});

		return () => {
			abort.abort();
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [attachment, apiBaseUrl, headers, scope]);

	const typeLabel = (meta.mime.split('/').pop() || extensionOf(attachment.name) || '').toUpperCase();
	const details = [attachment.kind === 'PAGE' ? t('AI_ASSISTANT.PREVIEW_PAGE', 'Page') : typeLabel, formatBytes(meta.size)]
		.filter(Boolean)
		.join(' · ');

	// An image opens as a lightbox — straight on the dimmed backdrop, no frame — everything else
	// in a centred panel, the way Claude opens an attached file.
	const isLightbox = view.type === 'image';
	// Documents fill the panel's height; short content (loading, details, audio) sizes to itself.
	const fillsHeight = view.type === 'pdf' || view.type === 'text' || view.type === 'markdown' || view.type === 'video';

	const backdropStyle: CSSProperties = {
		position: 'absolute',
		inset: 0,
		zIndex: 6,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 12,
		backgroundColor: isLightbox ? 'rgba(0, 0, 0, 0.82)' : 'rgba(0, 0, 0, 0.5)',
		backdropFilter: 'blur(3px)',
		animation: 'fadeIn 0.15s ease'
	};

	const dialogStyle: CSSProperties = isLightbox
		? { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: 0, color: '#ffffff' }
		: {
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				maxHeight: '100%',
				height: fillsHeight ? '100%' : undefined,
				minHeight: 0,
				overflow: 'hidden',
				borderRadius: 12,
				border: `1px solid ${chatTheme.border}`,
				backgroundColor: 'var(--gz-chat-surface, #18181b)',
				// A modal needs to lift off the conversation behind it; kept soft.
				boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)'
			};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 6,
		padding: isLightbox ? '0 0 10px' : '10px 10px 10px 14px',
		borderBottom: isLightbox ? 'none' : `1px solid ${chatTheme.border}`
	};

	const iconButtonStyle: CSSProperties = {
		width: 26,
		height: 26,
		flexShrink: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 0,
		border: 'none',
		borderRadius: 6,
		backgroundColor: 'transparent',
		color: isLightbox ? 'rgba(255, 255, 255, 0.8)' : chatTheme.textMuted,
		cursor: 'pointer',
		outline: 'none'
	};

	const bodyStyle: CSSProperties = {
		flex: 1,
		minHeight: 0,
		overflow: 'auto',
		padding: isLightbox ? 0 : 14,
		display: 'flex',
		flexDirection: 'column'
	};

	/** Zero-size, out of the layout: a focus guard is only ever a stop on the way back around. */
	const focusGuardStyle: CSSProperties = { position: 'absolute', width: 0, height: 0, overflow: 'hidden', outline: 'none' };

	const centredStyle: CSSProperties = {
		margin: 'auto',
		textAlign: 'center',
		color: chatTheme.textSecondary,
		fontSize: chatTheme.fontSizeSmall,
		lineHeight: 1.6
	};

	/**
	 * "Open in a new tab" gets an object URL of its OWN, from the same blob, and it is never revoked
	 * here. The preview's URL is revoked when the preview closes, and a reload in the new tab would
	 * then fail against it; a timed revoke only delays that failure. A blob URL lives as long as the
	 * document that created it, so this one is released when the app itself unloads.
	 */
	const openPdfInNewTab = () => {
		if (view.type !== 'pdf') return;
		window.open(URL.createObjectURL(view.blob), '_blank', 'noopener');
	};

	return (
		<div
			style={backdropStyle}
			// A press on the dimmed backdrop itself — not inside the panel — closes the preview.
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					event.preventDefault();
					event.stopPropagation();
					onClose();
				} else if (event.key === 'Tab') {
					trapFocus(event);
				}
			}}
		>
		{/* Focus guards. Key presses inside the embedded PDF never reach this document, so Tab
		    out of the frame cannot be trapped by the key handler; landing on a guard sends focus
		    back around the dialog instead of on to the chat behind it. */}
		<span tabIndex={0} aria-hidden="true" style={focusGuardStyle} onFocus={() => focusableInDialog().pop()?.focus()} />
		<div
			ref={dialogRef}
			style={dialogStyle}
			role="dialog"
			aria-modal="true"
			aria-label={`${t('AI_ASSISTANT.PREVIEW', 'Preview')}: ${attachment.name}`}
		>
			<div style={headerStyle}>
				<span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
					<span
						title={attachment.name}
						style={{
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							fontSize: chatTheme.fontSizeBase,
							fontWeight: chatTheme.fontWeightMedium
						}}
					>
						{attachment.name}
					</span>
					{details && (
						<span
							style={{
								fontSize: chatTheme.fontSizeSmall,
								color: isLightbox ? 'rgba(255, 255, 255, 0.65)' : chatTheme.textSecondary
							}}
						>
							{details}
						</span>
					)}
				</span>

				{view.type === 'pdf' && (
					<button
						type="button"
						className="gz-ai-chat-head-btn"
						style={iconButtonStyle}
						title={t('AI_ASSISTANT.PREVIEW_NEW_TAB', 'Open in a new tab')}
						aria-label={t('AI_ASSISTANT.PREVIEW_NEW_TAB', 'Open in a new tab')}
						onClick={openPdfInNewTab}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M15 3h6v6" />
							<path d="M10 14 21 3" />
							<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
						</svg>
					</button>
				)}
				{attachment.documentId && onOpenInDocuments && (
					<button
						type="button"
						className="gz-ai-chat-head-btn"
						style={iconButtonStyle}
						title={t('AI_ASSISTANT.ATTACH_OPEN', 'Open attached document')}
						aria-label={t('AI_ASSISTANT.ATTACH_OPEN', 'Open attached document')}
						onClick={() => onOpenInDocuments(attachment)}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
						</svg>
					</button>
				)}
				<button
					ref={closeRef}
					type="button"
					className="gz-ai-chat-head-btn"
					style={iconButtonStyle}
					title={t('AI_ASSISTANT.PREVIEW_CLOSE', 'Close preview')}
					aria-label={t('AI_ASSISTANT.PREVIEW_CLOSE', 'Close preview')}
					onClick={onClose}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			<div
				className="gz-ai-chat-scroll"
				style={bodyStyle}
				// In the lightbox the body IS the backdrop around the image: a press there closes too.
				onMouseDown={(event) => {
					if (isLightbox && event.target === event.currentTarget) onClose();
				}}
			>
				{view.type === 'loading' && <div style={centredStyle}>{t('AI_ASSISTANT.LOADING', 'Loading…')}</div>}

				{view.type === 'image' && (
					<img
						src={view.url}
						alt={attachment.name}
						style={{ margin: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
					/>
				)}

				{view.type === 'pdf' && (
					<iframe
						src={view.url}
						title={attachment.name}
						style={{ flex: 1, width: '100%', minHeight: 320, border: `1px solid ${chatTheme.border}`, borderRadius: 8, background: '#fff' }}
					/>
				)}

				{view.type === 'video' && (
					<video src={view.url} controls style={{ margin: 'auto', maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
				)}

				{view.type === 'audio' && <audio src={view.url} controls style={{ margin: 'auto', width: '100%' }} />}

				{view.type === 'text' && (
					<pre
						style={{
							margin: 0,
							whiteSpace: 'pre-wrap',
							wordBreak: 'break-word',
							fontFamily: chatTheme.fontFamilyMono,
							fontSize: chatTheme.fontSizeMessage,
							lineHeight: 1.6,
							color: chatTheme.textBody
						}}
					>
						{view.text}
					</pre>
				)}

				{view.type === 'markdown' && <MarkdownContent content={view.text} />}

				{view.type === 'info' && (
					<div style={centredStyle}>
						<svg
							width="28"
							height="28"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							style={{ marginBottom: 6, opacity: 0.7 }}
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
						</svg>
						<div>{t('AI_ASSISTANT.PREVIEW_UNAVAILABLE', 'No preview is available for this file.')}</div>
						{attachment.documentId && onOpenInDocuments && (
							<button
								type="button"
								onClick={() => onOpenInDocuments(attachment)}
								style={{
									marginTop: 8,
									border: 'none',
									background: 'none',
									padding: 0,
									color: chatTheme.accent,
									cursor: 'pointer',
									font: 'inherit',
									textDecoration: 'underline'
								}}
							>
								{t('AI_ASSISTANT.PREVIEW_OPEN_IN_DOCUMENTS', 'Open in Documents')}
							</button>
						)}
					</div>
				)}
			</div>
		</div>
		<span tabIndex={0} aria-hidden="true" style={focusGuardStyle} onFocus={() => focusableInDialog()[0]?.focus()} />
		</div>
	);
}
