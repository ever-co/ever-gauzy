import { type CSSProperties, useState, useRef, useEffect } from 'react';
import { playgroundTheme as t } from '../../playground-theme';

export interface ModelOption {
	id: string;
	name: string;
	provider?: string;
}

export interface ModelSelectorProps {
	models: ModelOption[];
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
}

/**
 * ModelSelector — dropdown for selecting an AI model.
 * Displays model name and optional provider label.
 */
export function ModelSelector({ models, selectedModelId, onModelChange }: ModelSelectorProps) {
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

	const selected = models.find((m) => m.id === selectedModelId);

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
					{models.map((model) => (
						<div
							key={model.id}
							role="option"
							aria-selected={model.id === selectedModelId}
							style={{
								...optionBaseStyle,
								background: model.id === selectedModelId ? t.accentSubtle : 'transparent'
							}}
							onClick={() => {
								onModelChange(model.id);
								setOpen(false);
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									onModelChange(model.id);
									setOpen(false);
								}
							}}
							tabIndex={0}
						>
							<span style={{ fontWeight: 500 }}>{model.name}</span>
							{model.provider && (
								<span style={{ fontSize: t.fontSizeXs, color: t.textSecondary, fontWeight: 400 }}>
									{model.provider}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
