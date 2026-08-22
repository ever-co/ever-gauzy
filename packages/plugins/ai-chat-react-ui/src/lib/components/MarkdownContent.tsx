import { memo, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Streamdown } from 'streamdown';
import { chatTheme } from '../chat-theme';

export interface MarkdownContentProps {
	content: string;
	/** True while this message is still streaming in. */
	isStreaming?: boolean;
}

type MarkdownListItemProps = Record<string, unknown> & {
	className?: string;
	children?: ReactNode;
};

function MarkdownListItem({ className, children, ...props }: MarkdownListItemProps) {
	const listItemClassName = className
		?.split(/\s+/)
		.filter((className) => className !== 'py-1')
		.join(' ');

	return (
		<li {...(props as ComponentProps<'li'>)} className={listItemClassName || undefined}>
			{children}
		</li>
	);
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
		fontSize: chatTheme.fontSizeMessage,
		lineHeight: chatTheme.lineHeightMessage,
		color: 'inherit',
		wordBreak: 'break-word'
	};

	return (
		<div style={style} className="gz-ai-chat-markdown">
			<Streamdown mode={isStreaming ? 'streaming' : 'static'} components={{ li: MarkdownListItem }}>
				{content}
			</Streamdown>
		</div>
	);
});
