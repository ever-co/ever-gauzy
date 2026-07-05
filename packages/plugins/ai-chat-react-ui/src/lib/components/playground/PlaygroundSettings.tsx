import { type CSSProperties, type ReactNode } from 'react';
import { playgroundTheme as t } from '../../playground-theme';
import { ModelSelector, type ModelOption } from './ModelSelector';
import { SettingsControl } from './SettingsControl';

export interface PlaygroundSettingsProps {
	models: ModelOption[];
	selectedModelId: string;
	/** Provider of the selected model (disambiguates duplicate model ids). */
	selectedProviderId?: string;
	/** Called with the model id and (when known) its provider id. */
	onModelChange: (modelId: string, providerId?: string) => void;

	systemPrompt: string;
	onSystemPromptChange: (value: string) => void;
	/**
	 * Disables the system prompt editor. The Gauzy backend builds its own
	 * system prompt, so the playground keeps this visible but not wired.
	 */
	systemPromptDisabled?: boolean;

	temperature: number;
	onTemperatureChange: (value: number) => void;

	maxTokens: number;
	onMaxTokensChange: (value: number) => void;

	topP: number;
	onTopPChange: (value: number) => void;

	/**
	 * Disables the parameter sliders. The backend does not accept
	 * temperature / topP / maxTokens yet, so the playground keeps the
	 * sliders visible but not wired.
	 */
	parametersDisabled?: boolean;

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

const noteStyle: CSSProperties = {
	fontSize: t.fontSizeXs,
	color: t.textHint,
	marginTop: '0.375rem',
	lineHeight: 1.4
};

/**
 * PlaygroundSettings — left panel with model selector, system prompt,
 * and parameter controls (Temperature, Max Tokens, Top P).
 *
 * Controls that the backend does not support yet stay visible but are
 * disabled with an explanatory note, so the UI never pretends a value
 * is being applied when it is not.
 */
export function PlaygroundSettings({
	models,
	selectedModelId,
	selectedProviderId,
	onModelChange,
	systemPrompt,
	onSystemPromptChange,
	systemPromptDisabled = false,
	temperature,
	onTemperatureChange,
	maxTokens,
	onMaxTokensChange,
	topP,
	onTopPChange,
	parametersDisabled = false,
	collapsed = false,
	children
}: PlaygroundSettingsProps) {
	const textareaStyle: CSSProperties = {
		width: '100%',
		minHeight: '5rem',
		padding: '0.5rem 0.75rem',
		fontSize: t.fontSizeSm,
		fontFamily: t.font,
		color: systemPromptDisabled ? t.textHint : t.textPrimary,
		background: t.bgInput,
		border: `1px solid ${t.border}`,
		borderRadius: t.radius,
		outline: 'none',
		resize: 'vertical',
		lineHeight: 1.5,
		boxSizing: 'border-box' as const,
		cursor: systemPromptDisabled ? 'not-allowed' : 'text'
	};

	return (
		// `inert` removes the collapsed panel's controls from the tab order / a11y tree.
		<div style={collapsed ? panelCollapsedStyle : panelExpandedStyle} inert={collapsed}>
			{/* Model */}
			<div style={sectionStyle}>
				<ModelSelector
					models={models}
					selectedModelId={selectedModelId}
					selectedProviderId={selectedProviderId}
					onModelChange={onModelChange}
				/>
			</div>

			{/* System Prompt */}
			<div style={sectionStyle}>
				<div style={sectionTitleStyle}>System Prompt</div>
				<textarea
					style={textareaStyle}
					value={systemPrompt}
					onChange={(e) => onSystemPromptChange(e.target.value)}
					placeholder="You are a helpful assistant…"
					disabled={systemPromptDisabled}
					title={
						systemPromptDisabled
							? 'The Gauzy backend builds its own system prompt — this editor is not wired yet.'
							: undefined
					}
				/>
				{systemPromptDisabled && (
					<div style={noteStyle}>Managed by the server — custom system prompts are not wired yet.</div>
				)}
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
					disabled={parametersDisabled}
					title={parametersDisabled ? 'Not supported by the backend yet.' : undefined}
				/>
				<SettingsControl
					label="Max Tokens"
					value={maxTokens}
					min={1}
					max={16384}
					step={1}
					onChange={onMaxTokensChange}
					disabled={parametersDisabled}
					title={parametersDisabled ? 'Not supported by the backend yet.' : undefined}
				/>
				<SettingsControl
					label="Top P"
					value={topP}
					min={0}
					max={1}
					step={0.05}
					onChange={onTopPChange}
					disabled={parametersDisabled}
					title={parametersDisabled ? 'Not supported by the backend yet.' : undefined}
				/>
				{parametersDisabled && (
					<div style={noteStyle}>These parameters are not supported by the backend yet.</div>
				)}
			</div>

			{/* Extra children */}
			{children && <div style={sectionStyle}>{children}</div>}
		</div>
	);
}
