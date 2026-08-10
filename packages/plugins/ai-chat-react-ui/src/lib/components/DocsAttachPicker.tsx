import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { chatTheme } from '../chat-theme';

/** How many results the picker shows at a time. */
const PAGE_SIZE = 20;

/** Debounce on the search box, so typing does not fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 250;

/** The subset of a document this picker needs. */
export interface IAttachableDocument {
	id: string;
	name: string;
	kind?: string;
	mimeType?: string;
	updatedAt?: string;
}

export interface DocsAttachPickerProps {
	/** API origin, e.g. `environment.API_BASE_URL`. */
	apiBaseUrl: string;
	/** Auth + tenant headers for the request (the panel already builds these for every call). */
	headers: () => Record<string, string>;
	/**
	 * Tenant/organization scope for the QUERY. The docs list endpoint validates a `where` object
	 * (`where[organizationId]` is required) — the Tenant-Id/Organization-Id headers do not satisfy
	 * it, and flat `organizationId` params are whitelisted away. Without this the endpoint answers
	 * 400 for every request, which the first version of this picker misreported as "Documents are
	 * not available in this workspace".
	 */
	scope: () => { organizationId?: string; tenantId?: string };
	/** The user chose a document. */
	onPick: (document: IAttachableDocument) => void;
	/** Dismiss without choosing. */
	onClose: () => void;
	/** `t(key, fallback)` from the panel. */
	translate?: (key: string, fallback: string) => string;
}

/**
 * DocsAttachPicker
 *
 * "Attach from Documents": a compact search-and-pick list over the Documents hub, so a user can
 * point the assistant at a document that is ALREADY in the workspace instead of re-uploading it.
 *
 * Reads `GET /api/plugins/docs/documents`, the hub's own list endpoint, with the caller's own
 * JWT — so the picker can only ever show documents that user is allowed to read, and there is no
 * second authorization path to keep in sync. Folders are excluded: a folder has nothing the
 * assistant can read.
 *
 * A picked document is attached BY ID, which is what makes it useful: the chat's `docs_read`
 * tool takes a document id, so the assistant can open exactly what the user pointed at rather
 * than searching for something with a similar name.
 */
export function DocsAttachPicker({ apiBaseUrl, headers, scope, onPick, onClose, translate }: DocsAttachPickerProps) {
	const t = translate ?? ((_key: string, fallback: string) => fallback);
	const [query, setQuery] = useState('');
	const [documents, setDocuments] = useState<IAttachableDocument[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [failure, setFailure] = useState<'unavailable' | 'error' | null>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	// Bumped on every request so a slow earlier response can never overwrite a newer one.
	const requestSeq = useRef(0);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	const load = useCallback(
		(search: string) => {
			const seq = ++requestSeq.current;
			setIsLoading(true);
			setFailure(null);

			const params = new URLSearchParams({ take: String(PAGE_SIZE), sort: 'updatedAt', sortOrder: 'DESC' });
			// The endpoint's DTO requires the scope inside a `where` object (bracket syntax — the
			// API's extended query parser reassembles it into the nested shape the validator wants).
			const { organizationId, tenantId } = scope();
			if (organizationId) params.set('where[organizationId]', organizationId);
			if (tenantId) params.set('where[tenantId]', tenantId);
			// Folders hold no readable content — offering one would attach nothing.
			params.set('kind', 'FILE,PAGE');
			if (search.trim()) {
				params.set('q', search.trim());
			}

			fetch(`${apiBaseUrl}/api/plugins/docs/documents?${params.toString()}`, { headers: headers() })
				.then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
				.then((page: { items?: IAttachableDocument[] }) => {
					if (seq !== requestSeq.current) return;
					setDocuments(Array.isArray(page?.items) ? page.items : []);
				})
				.catch((error: unknown) => {
					if (seq !== requestSeq.current) return;
					setDocuments([]);
					// Only "the feature is not here for you" statuses may claim unavailability:
					// 404 = docs plugin not installed, 403 = no DOCS_READ / feature disabled.
					// Anything else is a FAILURE and must say so — the first version showed
					// "Documents are not available" for its own 400s, hiding a plain bug behind
					// a message that blamed the workspace.
					const status = error instanceof Error ? error.message : '';
					setFailure(status === '403' || status === '404' ? 'unavailable' : 'error');
				})
				.finally(() => {
					if (seq === requestSeq.current) setIsLoading(false);
				});
		},
		[apiBaseUrl, headers, scope]
	);

	useEffect(() => {
		const timer = setTimeout(() => load(query), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query, load]);

	const overlayStyle: CSSProperties = {
		// Fills the chat BODY (the panel mounts this inside its position:relative body container),
		// so the panel's own header row stays visible and operable above it.
		position: 'absolute',
		inset: 0,
		zIndex: 6,
		display: 'flex',
		flexDirection: 'column',
		// The chat theme has no opaque surface token (surfaces are currentColor tints over
		// transparent — the Angular layout paints the real background), so a tint alone let the
		// conversation show through the picker. The layout publishes its sidebar surface as
		// --gz-chat-surface; the blur is the fallback for hosts that do not (detached window).
		backgroundColor: 'var(--gz-chat-surface, transparent)',
		backdropFilter: 'blur(12px)',
		animation: 'fadeIn 0.15s ease'
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		padding: '8px 10px',
		borderBottom: `1px solid ${chatTheme.border}`
	};

	const searchStyle: CSSProperties = {
		flex: 1,
		padding: '6px 8px',
		borderRadius: 6,
		border: `1px solid ${chatTheme.border}`,
		backgroundColor: chatTheme.surfaceDeep,
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeBase,
		outline: 'none'
	};

	const listStyle: CSSProperties = { flex: 1, overflowY: 'auto', padding: 6 };

	const itemStyle: CSSProperties = {
		display: 'block',
		width: '100%',
		textAlign: 'left',
		padding: '7px 9px',
		borderRadius: 6,
		border: 'none',
		background: 'transparent',
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeBase,
		cursor: 'pointer'
	};

	const emptyStyle: CSSProperties = {
		padding: 14,
		color: chatTheme.textSecondary,
		fontSize: chatTheme.fontSizeSmall,
		textAlign: 'center'
	};

	return (
		<div style={overlayStyle} role="dialog" aria-label={t('AI_ASSISTANT.ATTACH_FROM_DOCUMENTS', 'Attach from Documents')}>
			<div style={headerStyle}>
				<input
					ref={searchRef}
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							onClose();
						}
					}}
					placeholder={t('AI_ASSISTANT.ATTACH_SEARCH', 'Search documents…')}
					aria-label={t('AI_ASSISTANT.ATTACH_SEARCH', 'Search documents…')}
					style={searchStyle}
				/>
				<button
					type="button"
					onClick={onClose}
					style={{
						...itemStyle,
						width: 'auto',
						padding: '6px 10px',
						border: `1px solid ${chatTheme.border}`
					}}
				>
					{t('AI_ASSISTANT.CANCEL', 'Cancel')}
				</button>
			</div>

			<div style={listStyle}>
				{isLoading && <div style={emptyStyle}>{t('AI_ASSISTANT.LOADING', 'Loading…')}</div>}

				{!isLoading &&
					documents.map((document) => (
						<button
							key={document.id}
							type="button"
							style={itemStyle}
							onClick={() => onPick(document)}
							title={document.name}
						>
							<span aria-hidden="true">{document.kind === 'PAGE' ? '📝' : '📄'}</span>{' '}
							<span>{document.name}</span>
						</button>
					))}

				{!isLoading && !documents.length && (
					<div style={emptyStyle}>
						{failure === 'unavailable'
							? t('AI_ASSISTANT.ATTACH_UNAVAILABLE', 'Documents are not available in this workspace.')
							: failure === 'error'
							? t('AI_ASSISTANT.ATTACH_LOAD_FAILED', 'The document list could not be loaded — please try again.')
							: t('AI_ASSISTANT.ATTACH_NO_RESULTS', 'No matching documents.')}
					</div>
				)}
			</div>
		</div>
	);
}
