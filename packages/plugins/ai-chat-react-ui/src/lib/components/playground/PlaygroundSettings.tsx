import { type CSSProperties, type ReactNode } from 'react';
import { playgroundTheme as t } from '../../playground-theme';
import { ModelSelector, type ModelOption } from './ModelSelector';
import { SettingsControl } from './SettingsControl';

export interface PlaygroundSettingsProps {
	models: ModelOption[];
	selectedModelId: string;
	onModelChange: (modelId: string) => void;

	systemPrompt: string;
	onSystemPromptChange: (value: string) => void;

	temperature: number;
	onTemperatureChange: (value: number) => void;

	maxTokens: number;
	onMaxTokensChange: (value: number) => void;

	topP: number;
	onTopPChange: (value: number) => void;

	/** Whether the panel is collapsed. */
	collapsed?: boolean;

	/** Extra controls rendered below the default parameter sliders. */
	children?: ReactNode;
}

const panelExpandedStyle: CSSProperties = {
	width: t.settingsPanelWidth,
	flexShrink: 0,
	display: 'flex',
	flexDirection: 'column',
	borderRight: `1px solid ${t.border}`,
	background: t.bg,
	overflowY: 'auto',
	transition: `width ${t.transition}, opacity ${t.transition}`,
	opacity: 1
};

const panelCollapsedStyle: CSSProperties = {
	width: 0,
	flexShrink: 0,
	display: 'flex',
	flexDirection: 'column',
	borderRight: 'none',
	background: t.bg,
	overflow: 'hidden',
	transition: `width ${t.transition}, opacity ${t.transition}`,
	opacity: 0
};

const sectionStyle: CSSProperties = {
	padding: '1rem',
	borderBottom: `1px solid ${t.border}`
};

const sectionTitleStyle: CSSProperties = {
	fontSize: t.fontSizeXs,
	fontWeight: 600,
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	color: t.textSecondary,
	marginBottom: '0.75rem'
};

const textareaStyle: CSSProperties = {
	width: '100%',
	minHeight: '5rem',
	padding: '0.5rem 0.75rem',
	fontSize: t.fontSizeSm,
	fontFamily: t.font,
	color: t.textPrimary,
	background: t.bgInput,
	border: `1px solid ${t.border}`,
	borderRadius: t.radius,
	outline: 'none',
	resize: 'vertical',
	lineHeight: 1.5,
	boxSizing: 'border-box' as const
};

/**
 * PlaygroundSettings — left panel with model selector, system prompt,
 * and parameter controls (Temperature, Max Tokens, Top P).
 */
export function PlaygroundSettings({
	models,
	selectedModelId,
	onModelChange,
	systemPrompt,
	onSystemPromptChange,
	temperature,
	onTemperatureChange,
	maxTokens,
	onMaxTokensChange,
	topP,
	onTopPChange,
	collapsed = false,
	children
}: PlaygroundSettingsProps) {
	return (
		<div style={collapsed ? panelCollapsedStyle : panelExpandedStyle}>
			{/* Model */}
			<div style={sectionStyle}>
				<ModelSelector models={models} selectedModelId={selectedModelId} onModelChange={onModelChange} />
			</div>

			{/* System Prompt */}
			<div style={sectionStyle}>
				<div style={sectionTitleStyle}>System Prompt</div>
				<textarea
					style={textareaStyle}
					value={systemPrompt}
					onChange={(e) => onSystemPromptChange(e.target.value)}
					placeholder="You are a helpful assistant…"
				/>
			</div>

			{/* Parameters */}
			<div style={sectionStyle}>
				<div style={sectionTitleStyle}>Parameters</div>
				<SettingsControl
					label="Temperature"
					value={temperature}
					min={0}
					max={2}
					step={0.1}
					onChange={onTemperatureChange}
				/>
				<SettingsControl
					label="Max Tokens"
					value={maxTokens}
					min={1}
					max={16384}
					step={1}
					onChange={onMaxTokensChange}
				/>
				<SettingsControl label="Top P" value={topP} min={0} max={1} step={0.05} onChange={onTopPChange} />
			</div>

			{/* Extra children */}
			{children && <div style={sectionStyle}>{children}</div>}
		</div>
	);
}
