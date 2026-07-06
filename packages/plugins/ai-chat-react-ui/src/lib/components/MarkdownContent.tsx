import { memo, type CSSProperties } from 'react';
import { Streamdown } from 'streamdown';
import { chatTheme } from '../chat-theme';

export interface MarkdownContentProps {
	content: string;
	/** True while this message is still streaming in. */
	isStreaming?: boolean;
}

/**
 * MarkdownContent
 *
 * Markdown renderer for assistant messages, built on Vercel's
 * `streamdown` — a drop-in replacement for react-markdown designed for
 * AI streaming: it renders incomplete/unterminated markdown blocks
 * gracefully while tokens arrive, with GFM (tables, lists, task lists)
 * and hardened HTML handling out of the box.
 *
 * Styles come from `streamdown/styles.css` (loaded by the host app,
 * see apps/gauzy angular.json). Colors inherit from the chat theme.
 */
export const MarkdownContent = memo(function MarkdownContent({ content, isStreaming }: MarkdownContentProps) {
	const style: CSSProperties = {
		fontSize: chatTheme.fontSizeBase,
		lineHeight: 1.6,
		color: 'inherit',
		wordBreak: 'break-word'
	};

	return (
		<div style={style} className="gz-ai-chat-markdown">
			<Streamdown mode={isStreaming ? 'streaming' : 'static'}>{content}</Streamdown>
		</div>
	);
});
