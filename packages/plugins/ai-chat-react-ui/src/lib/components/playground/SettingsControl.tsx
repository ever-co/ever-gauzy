import { type CSSProperties } from 'react';
import { playgroundTheme as t } from '../../playground-theme';

export interface SettingsControlProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
}

/**
 * SettingsControl — labelled range slider for model parameters
 * (temperature, maxTokens, topP, etc.).
 */
export function SettingsControl({ label, value, min, max, step, onChange }: SettingsControlProps) {
	const labelStyle: CSSProperties = {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		fontSize: t.fontSizeSm,
		fontWeight: 500,
		color: t.textPrimary,
		marginBottom: '0.375rem'
	};

	const valueStyle: CSSProperties = {
		fontSize: t.fontSizeSm,
		fontWeight: 600,
		color: t.textSecondary,
		fontVariantNumeric: 'tabular-nums'
	};

	return (
		<div style={{ marginBottom: '0.75rem' }}>
			<div style={labelStyle}>
				<span>{label}</span>
				<span style={valueStyle}>{value}</span>
			</div>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				style={{ width: '100%', accentColor: t.accent, cursor: 'pointer', margin: 0 }}
			/>
		</div>
	);
}
