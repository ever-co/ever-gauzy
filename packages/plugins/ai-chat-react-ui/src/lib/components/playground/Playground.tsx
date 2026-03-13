import { type CSSProperties, useState, useCallback, type ReactNode } from 'react';
import { playgroundTheme as t } from '../../playground-theme';
import { PlaygroundHeader } from './PlaygroundHeader';
import { PlaygroundSettings, type PlaygroundSettingsProps } from './PlaygroundSettings';
import { PlaygroundChatPanel } from './PlaygroundChatPanel';
import { type PlaygroundChatMessageProps } from './PlaygroundChatMessage';
import { type ModelOption } from './ModelSelector';

/** Default models shown when none are provided. */
const DEFAULT_MODELS: ModelOption[] = [
	{ id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
	{ id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
	{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
	{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' }
];

export interface PlaygroundProps {
	/** Title shown in the header bar. */
	title?: string;
	/** Available models for the selector. */
	models?: ModelOption[];
	/** Chat messages to display (controlled mode). */
	messages?: PlaygroundChatMessageProps[];
	/** Whether the assistant is currently generating. */
	loading?: boolean;

	/** Called when the user sends a message. */
	onSend?: (message: string) => void;
	/** Called when the user clicks "New Chat". */
	onNewChat?: () => void;

	/* ── Controlled settings (all optional — provide to control externally) ── */
	selectedModelId?: string;
	onModelChange?: (modelId: string) => void;
	systemPrompt?: string;
	onSystemPromptChange?: (value: string) => void;
	temperature?: number;
	onTemperatureChange?: (value: number) => void;
	maxTokens?: number;
	onMaxTokensChange?: (value: number) => void;
	topP?: number;
	onTopPChange?: (value: number) => void;

	/** Extra content rendered inside the settings panel. */
	settingsExtra?: ReactNode;
	/** Content rendered inside the chat panel header. */
	chatHeader?: ReactNode;
	/** Custom placeholder for the chat input. */
	inputPlaceholder?: string;
	/** Optional outer style overrides. */
	style?: CSSProperties;
}

/**
 * Playground — full AI chat playground layout matching the Vercel AI SDK
 * Playground aesthetic.
 *
 * Renders a settings panel (model selector, system prompt, parameter
 * sliders) on the left and a chat panel (messages + input) on the right.
 *
 * Supports both controlled and uncontrolled modes — when external state
 * handlers are omitted, settings are managed internally.
 */
export function Playground({
	title,
	models = DEFAULT_MODELS,
	messages: controlledMessages,
	loading = false,
	onSend: controlledOnSend,
	onNewChat: controlledOnNewChat,
	selectedModelId: controlledModelId,
	onModelChange: controlledModelChange,
	systemPrompt: controlledSystemPrompt,
	onSystemPromptChange: controlledSystemPromptChange,
	temperature: controlledTemperature,
	onTemperatureChange: controlledTemperatureChange,
	maxTokens: controlledMaxTokens,
	onMaxTokensChange: controlledMaxTokensChange,
	topP: controlledTopP,
	onTopPChange: controlledTopPChange,
	settingsExtra,
	chatHeader,
	inputPlaceholder,
	style
}: PlaygroundProps) {
	// Internal state (used when component is uncontrolled)
	const [_modelId, _setModelId] = useState(models[0]?.id ?? '');
	const [_systemPrompt, _setSystemPrompt] = useState('');
	const [_temperature, _setTemperature] = useState(0.7);
	const [_maxTokens, _setMaxTokens] = useState(4096);
	const [_topP, _setTopP] = useState(1);
	const [_messages, _setMessages] = useState<PlaygroundChatMessageProps[]>([]);
	const [sidebarExpanded, setSidebarExpanded] = useState(true);

	const toggleSidebar = useCallback(() => setSidebarExpanded((v) => !v), []);

	const messages = controlledMessages ?? _messages;

	// Default send handler — appends user message locally
	const handleSend = useCallback(
		(text: string) => {
			if (controlledOnSend) {
				controlledOnSend(text);
			} else {
				_setMessages((prev) => [
					...prev,
					{ role: 'user' as const, content: text, timestamp: new Date().toISOString() }
				]);
			}
		},
		[controlledOnSend]
	);

	// Default new chat handler — clears messages
	const handleNewChat = useCallback(() => {
		if (controlledOnNewChat) {
			controlledOnNewChat();
		} else {
			_setMessages([]);
		}
	}, [controlledOnNewChat]);

	const settingsProps: PlaygroundSettingsProps = {
		models,
		selectedModelId: controlledModelId ?? _modelId,
		onModelChange: controlledModelChange ?? _setModelId,
		systemPrompt: controlledSystemPrompt ?? _systemPrompt,
		onSystemPromptChange: controlledSystemPromptChange ?? _setSystemPrompt,
		temperature: controlledTemperature ?? _temperature,
		onTemperatureChange: controlledTemperatureChange ?? _setTemperature,
		maxTokens: controlledMaxTokens ?? _maxTokens,
		onMaxTokensChange: controlledMaxTokensChange ?? _setMaxTokens,
		topP: controlledTopP ?? _topP,
		onTopPChange: controlledTopPChange ?? _setTopP
	};

	const rootStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		fontFamily: t.font,
		background: t.bg,
		color: t.textPrimary,
		borderRadius: t.radius,
		border: `1px solid ${t.border}`,
		boxShadow: t.shadow,
		overflow: 'hidden'
	};

	const bodyStyle: CSSProperties = {
		display: 'flex',
		flex: 1,
		minHeight: 0
	};

	return (
		<div style={{ ...rootStyle, ...style }}>
			{/* Keyframe for loading indicator */}
			<style>{`
				@keyframes pgPulse {
					0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
					40% { transform: scale(1); opacity: 1; }
				}
			`}</style>

			<PlaygroundHeader
				title={title}
				onNewChat={handleNewChat}
				sidebarExpanded={sidebarExpanded}
				onToggleSidebar={toggleSidebar}
			/>

			<div style={bodyStyle}>
				<PlaygroundSettings {...settingsProps} collapsed={!sidebarExpanded}>{settingsExtra}</PlaygroundSettings>

				<PlaygroundChatPanel
					messages={messages}
					onSend={handleSend}
					loading={loading}
					header={chatHeader}
					inputPlaceholder={inputPlaceholder}
				/>
			</div>
		</div>
	);
}
