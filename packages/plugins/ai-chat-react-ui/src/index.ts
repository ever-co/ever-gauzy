/*
 * Public API Surface of @gauzy/plugin-ai-chat-react-ui
 *
 * This package provides an inline collapsible AI Chat widget built with
 * the Vercel AI SDK (@ai-sdk/react), designed for the Gauzy left sidebar.
 *
 * Loosely coupled — registration flows through `plugin-ui.config.ts` via
 * `defineDeclarativePlugin`. No direct component imports needed in the host app.
 */

// Plugin definition (translations, settings, sidebar widget registration)
export { AiChatReactUiPlugin } from './lib/ai-chat-react-ui.plugin';

// Angular bridge component (used internally by the plugin bootstrap)
export { AiChatSidebarComponent } from './lib/ai-chat-sidebar.component';
export { PlaygroundPageComponent } from './lib/playground-page.component';

// Route config
export { PLAYGROUND_PATH, PLAYGROUND_ROUTE } from './lib/playground.routes';

// React components (for advanced composition / embedding)
export {
	AiChatPanel,
	ChatToggleBar,
	ChatMessageList,
	ChatMessageItem,
	ChatInput,
	ChatWelcome,
	MarkdownContent
} from './lib/components';

// Theme tokens
export { chatTheme } from './lib/chat-theme';
export { playgroundTheme } from './lib/playground-theme';

// Playground components (AI SDK-style playground UI)
export {
	Playground, type PlaygroundProps,
	PlaygroundHeader, type PlaygroundHeaderProps,
	PlaygroundSettings, type PlaygroundSettingsProps,
	PlaygroundChatPanel, type PlaygroundChatPanelProps,
	PlaygroundChatMessage, type PlaygroundChatMessageProps,
	PlaygroundChatInput, type PlaygroundChatInputProps,
	ModelSelector, type ModelSelectorProps, type ModelOption,
	SettingsControl, type SettingsControlProps
} from './lib/components/playground';
