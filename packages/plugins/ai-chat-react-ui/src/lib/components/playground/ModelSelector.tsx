import { type CSSProperties, useState, useRef, useEffect, useMemo } from 'react';
import { playgroundTheme as t } from '../../playground-theme';

export interface ModelOption {
	/** Model identifier as understood by the provider (e.g. 'claude-sonnet-5'). */
	id: string;
	/** Human-readable model label. */
	name: string;
	/** Human-readable provider label (used to group options). */
	provider?: string;
	/** Provider identifier (sent to the backend as `providerId`). */
	providerId?: string;
}

export interface ModelSelectorProps {
	models: ModelOption[];
	selectedModelId: string;
	/** Disambiguates models with the same id across providers. */
	selectedProviderId?: string;
	/** Called with the model id and (when known) its provider id. */
	onModelChange: (modelId: string, providerId?: string) => void;
}

/**
 * ModelSelector — dropdown for selecting an AI model.
 *
 * Options are grouped by provider label. Selection reports both the
 * model id and the provider id so the caller can route the request to
 * the right backend provider.
 */
export function ModelSelector({ models, selectedModelId, selectedProviderId, onModelChange }: ModelSelectorProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const isSelected = (model: ModelOption) =>
		model.id === selectedModelId &&
		(!selectedProviderId || !model.providerId || model.providerId === selectedProviderId);

	const selected = models.find(isSelected);

	/** Options grouped by provider label, preserving input order. */
	const groups = useMemo(() => {
		const map = new Map<string, ModelOption[]>();
		for (const model of models) {
			const key = model.provider ?? '';
			const group = map.get(key);
			if (group) {
				group.push(model);
			} else {
				map.set(key, [model]);
			}
		}
		return [...map.entries()];
	}, [models]);

	const triggerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		padding: '0.5rem 0.75rem',
		fontSize: t.fontSizeSm,
		fontWeight: 500,
		fontFamily: t.font,
		color: t.textPrimary,
		background: t.bg,
		border: `1px solid ${t.border}`,
		borderRadius: t.radius,
		cursor: 'pointer',
		outline: 'none',
		boxSizing: 'border-box' as const
	};

	const dropdownStyle: CSSProperties = {
		position: 'absolute',
		top: 'calc(100% + 4px)',
		left: 0,
		right: 0,
		background: t.bg,
		border: `1px solid ${t.border}`,
		borderRadius: t.radius,
		boxShadow: t.shadow,
		zIndex: 50,
		maxHeight: '240px',
		overflowY: 'auto'
	};

	const groupLabelStyle: CSSProperties = {
		padding: '0.375rem 0.75rem 0.25rem',
		fontSize: t.fontSizeXs,
		fontWeight: 600,
		textTransform: 'uppercase',
		letterSpacing: '0.05em',
		color: t.textSecondary,
		background: t.bgSubtle,
		borderBottom: `1px solid ${t.border}`
	};

	const optionBaseStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: '0.125rem',
		padding: '0.5rem 0.75rem',
		cursor: 'pointer',
		fontSize: t.fontSizeSm,
		color: t.textPrimary,
		borderBottom: `1px solid ${t.border}`
	};

	const emptyStyle: CSSProperties = {
		padding: '0.75rem',
		fontSize: t.fontSizeSm,
		color: t.textHint
	};

	const select = (model: ModelOption) => {
		onModelChange(model.id, model.providerId);
		setOpen(false);
	};

	return (
		<div ref={ref} style={{ position: 'relative', marginBottom: '0.75rem' }}>
			<label
				style={{
					display: 'block',
					fontSize: t.fontSizeSm,
					fontWeight: 500,
					color: t.textPrimary,
					marginBottom: '0.375rem'
				}}
			>
				Model
			</label>
			<button
				type="button"
				style={triggerStyle}
				onClick={() => setOpen(!open)}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span>{selected?.name ?? 'Select a model'}</span>
				<svg
					style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, color: t.textSecondary }}
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fillRule="evenodd"
						d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
						clipRule="evenodd"
					/>
				</svg>
			</button>

			{open && (
				<div style={dropdownStyle} role="listbox">
					{models.length === 0 && <div style={emptyStyle}>No models available</div>}
					{groups.map(([provider, groupModels]) => (
						<div key={provider || '_ungrouped'}>
							{provider && <div style={groupLabelStyle}>{provider}</div>}
							{groupModels.map((model) => (
								<div
									key={`${model.providerId ?? ''}:${model.id}`}
									role="option"
									aria-selected={isSelected(model)}
									style={{
										...optionBaseStyle,
										background: isSelected(model) ? t.accentSubtle : 'transparent'
									}}
									onClick={() => select(model)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											select(model);
										}
									}}
									tabIndex={0}
								>
									<span style={{ fontWeight: 500 }}>{model.name}</span>
									<span style={{ fontSize: t.fontSizeXs, color: t.textSecondary, fontWeight: 400 }}>
										{model.id}
									</span>
								</div>
							))}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
