import { type CSSProperties, useRef, useEffect, type ReactNode } from 'react';
import { playgroundTheme as t } from '../../playground-theme';
import { PlaygroundChatMessage, type PlaygroundChatMessageProps } from './PlaygroundChatMessage';
import { PlaygroundChatInput } from './PlaygroundChatInput';

export interface PlaygroundChatPanelProps {
	messages: PlaygroundChatMessageProps[];
	onSend: (message: string) => void;
	loading?: boolean;
	header?: ReactNode;
	inputPlaceholder?: string;
}

/**
 * PlaygroundChatPanel — right-side chat area with message list,
 * empty-state illustration, loading indicator, and input bar.
 */
export function PlaygroundChatPanel({
	messages,
	onSend,
	loading = false,
	header,
	inputPlaceholder
}: PlaygroundChatPanelProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length, loading]);

	const panelStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0,
		background: t.bg,
		borderLeft: `1px solid ${t.border}`
	};

	const headerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '0.75rem 1rem',
		borderBottom: `1px solid ${t.border}`,
		fontWeight: 600,
		fontSize: t.fontSizeBase,
		color: t.textPrimary
	};

	const messagesStyle: CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		display: 'flex',
		flexDirection: 'column'
	};

	const emptyStyle: CSSProperties = {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		gap: '0.5rem',
		color: t.textHint,
		padding: '2rem'
	};

	const dotStyle: CSSProperties = {
		width: '0.375rem',
		height: '0.375rem',
		borderRadius: '50%',
		background: t.textHint
	};

	return (
		<div style={panelStyle}>
			{header && <div style={headerStyle}>{header}</div>}

			<div style={messagesStyle}>
				{messages.length === 0 ? (
					<div style={emptyStyle}>
						<svg
							style={{ width: '3rem', height: '3rem', color: t.textHint, opacity: 0.5 }}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.5}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
							/>
						</svg>
						<span style={{ fontSize: t.fontSizeLg, fontWeight: 500 }}>Start a conversation</span>
						<span style={{ fontSize: t.fontSizeSm }}>Send a message to begin chatting with the model.</span>
					</div>
				) : (
					<>
						{messages.map((msg, i) => (
							<PlaygroundChatMessage key={i} {...msg} />
						))}
						{loading && (
							<div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
								<div style={{ ...dotStyle, animation: 'pgPulse 1.4s ease-in-out infinite' }} />
								<div style={{ ...dotStyle, animation: 'pgPulse 1.4s ease-in-out 0.2s infinite' }} />
								<div style={{ ...dotStyle, animation: 'pgPulse 1.4s ease-in-out 0.4s infinite' }} />
							</div>
						)}
						<div ref={bottomRef} />
					</>
				)}
			</div>

			<PlaygroundChatInput onSend={onSend} disabled={loading} placeholder={inputPlaceholder} />
		</div>
	);
}
