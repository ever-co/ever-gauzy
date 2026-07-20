import { type CSSProperties } from 'react';
import { playgroundTheme as t } from '../../playground-theme';

export interface SettingsControlProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void;
	/** Disables the slider (e.g. when the parameter is not wired to the backend). */
	disabled?: boolean;
	/** Tooltip shown on hover (e.g. explaining why the control is disabled). */
	title?: string;
}

/**
 * SettingsControl — labelled range slider for model parameters
 * (temperature, maxTokens, topP, etc.).
 */
export function SettingsControl({ label, value, min, max, step, onChange, disabled = false, title }: SettingsControlProps) {
	const labelStyle: CSSProperties = {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		fontSize: t.fontSizeSm,
		fontWeight: 500,
		color: disabled ? t.textHint : t.textPrimary,
		marginBottom: '0.375rem'
	};

	const valueStyle: CSSProperties = {
		fontSize: t.fontSizeSm,
		fontWeight: 600,
		color: t.textSecondary,
		fontVariantNumeric: 'tabular-nums'
	};

	return (
		<div style={{ marginBottom: '0.75rem' }} title={title}>
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
				disabled={disabled}
				aria-label={label}
				onChange={(e) => onChange(Number(e.target.value))}
				style={{
					width: '100%',
					accentColor: t.accent,
					cursor: disabled ? 'not-allowed' : 'pointer',
					opacity: disabled ? 0.5 : 1,
					margin: 0
				}}
			/>
		</div>
	);
}
