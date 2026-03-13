import { type CSSProperties, useState } from 'react';
import { chatTheme } from '../chat-theme';

export interface ChatToggleBarProps {
	isExpanded: boolean;
	onToggle: () => void;
	onNewChat: () => void;
	messageCount?: number;
}

/**
 * ChatToggleBar
 *
 * Collapsible header bar for the AI Chat widget, rendered inline
 * inside the left sidebar. When collapsed it shows a compact
 * "AI Chat" label with a badge count; when expanded it also
 * surfaces a "New conversation" action icon.
 */
export function ChatToggleBar({ isExpanded, onToggle, onNewChat, messageCount = 0 }: ChatToggleBarProps) {
	const [isHovered, setIsHovered] = useState(false);

	const barStyle: CSSProperties = {
		height: chatTheme.toggleBarHeight,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '0 8px 0 12px',
		backgroundColor: isHovered ? chatTheme.toggleBarHoverBg : chatTheme.toggleBarBg,
		borderLeft: `3px solid ${chatTheme.accent}`,
		cursor: 'pointer',
		transition: `background-color ${chatTheme.transitionSpeed} ease`,
		userSelect: 'none',
		flexShrink: 0
	};

	const titleStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		color: chatTheme.textPrimary,
		fontSize: chatTheme.fontSizeBase,
		fontWeight: 600
	};

	const actionsStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: 2
	};

	const iconBtnStyle: CSSProperties = {
		width: 28,
		height: 28,
		borderRadius: 6,
		border: 'none',
		backgroundColor: 'transparent',
		color: chatTheme.textSecondary,
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 0,
		transition: `all ${chatTheme.transitionSpeed} ease`
	};

	const badgeStyle: CSSProperties = {
		minWidth: 16,
		height: 16,
		borderRadius: 8,
		backgroundColor: chatTheme.accent,
		color: '#ffffff',
		fontSize: '0.625rem',
		fontWeight: 700,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		padding: '0 4px'
	};

	return (
		<div
			style={barStyle}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={onToggle}
			role="button"
			tabIndex={0}
			aria-expanded={isExpanded}
			aria-label="Toggle AI Chat"
		>
			{/* Left: icon + label + badge */}
			<div style={titleStyle}>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
				<span>AI Chat</span>
				{!isExpanded && messageCount > 0 && <span style={badgeStyle}>{messageCount}</span>}
			</div>

			{/* Right: new-chat button (expanded only) + chevron */}
			<div style={actionsStyle}>
				{isExpanded && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onNewChat();
						}}
						style={iconBtnStyle}
						title="New conversation"
						aria-label="New conversation"
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M12 20h9" />
							<path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
						</svg>
					</button>
				)}

				{/* Chevron – points down when collapsed, up when expanded */}
				<div style={{ ...iconBtnStyle, cursor: 'inherit' }}>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						style={{
							transition: `transform ${chatTheme.transitionSpeed} ease`,
							transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
						}}
					>
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</div>
			</div>
		</div>
	);
}
