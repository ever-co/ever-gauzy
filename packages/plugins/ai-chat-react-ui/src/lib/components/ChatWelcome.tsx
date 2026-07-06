import { type CSSProperties } from 'react';
import { chatTheme } from '../chat-theme';

/**
 * ChatWelcome
 *
 * Empty-state view shown when the conversation has no messages.
 * Compact layout for the narrow sidebar — shows a sparkle icon,
 * a short greeting, and a brief hint.
 */
export function ChatWelcome() {
	const containerStyle: CSSProperties = {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '20px 12px',
		textAlign: 'center',
		gap: 10
	};

	const iconContainerStyle: CSSProperties = {
		width: 44,
		height: 44,
		borderRadius: '50%',
		backgroundColor: chatTheme.accentLight,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		color: chatTheme.accent
	};

	const titleStyle: CSSProperties = {
		fontSize: chatTheme.fontSizeLarge,
		fontWeight: 600,
		color: chatTheme.textPrimary,
		margin: 0
	};

	const subtitleStyle: CSSProperties = {
		fontSize: chatTheme.fontSizeSmall,
		color: chatTheme.textSecondary,
		margin: 0,
		lineHeight: 1.5
	};

	return (
		<div style={containerStyle}>
			<div style={iconContainerStyle}>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
			</div>

			<h3 style={titleStyle}>AI Assistant</h3>
			<p style={subtitleStyle}>Ask anything about your workspace, tasks, or projects.</p>
		</div>
	);
}
