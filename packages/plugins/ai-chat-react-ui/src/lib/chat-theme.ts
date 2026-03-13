/**
 * Design tokens for the AI Chat sidebar panel.
 *
 * Uses semi-transparent colours optimised for dark sidebar backgrounds
 * (matching Gauzy's `gauzy-sidebar-background-2`).
 *
 * The chat panel renders as a dedicated sidebar between the nav menu
 * and the main page content area.
 */
export const chatTheme = {
	// ── Widget layout ─────────────────────────────────────────
	toggleBarHeight: 40,
	chatBodyHeight: 340,

	// ── Toggle bar ────────────────────────────────────────────
	toggleBarBg: 'rgba(51, 102, 255, 0.12)',
	toggleBarHoverBg: 'rgba(51, 102, 255, 0.22)',

	// ── Message bubbles ───────────────────────────────────────
	userBubbleBg: '#3366ff',
	userBubbleText: '#ffffff',
	assistantBubbleBg: 'rgba(255, 255, 255, 0.08)',
	assistantBubbleText: 'rgba(255, 255, 255, 0.87)',
	bubbleRadius: '12px',

	// ── Input ─────────────────────────────────────────────────
	inputBg: 'rgba(255, 255, 255, 0.06)',
	inputBorder: 'rgba(255, 255, 255, 0.12)',
	inputFocusBorder: 'rgba(255, 255, 255, 0.25)',
	inputText: 'rgba(255, 255, 255, 0.87)',
	inputPlaceholder: 'rgba(255, 255, 255, 0.4)',
	inputRadius: '8px',

	// ── Accent ────────────────────────────────────────────────
	accent: '#3366ff',
	accentHover: '#598bff',
	accentLight: 'rgba(51, 102, 255, 0.15)',

	// ── Typography ────────────────────────────────────────────
	fontFamily: 'inherit',
	fontSizeSmall: '0.75rem',
	fontSizeBase: '0.8125rem',
	fontSizeLarge: '0.875rem',

	// ── Text on dark background ───────────────────────────────
	textPrimary: 'rgba(255, 255, 255, 0.87)',
	textSecondary: 'rgba(255, 255, 255, 0.5)',
	textHint: 'rgba(255, 255, 255, 0.3)',

	// ── Borders / dividers ────────────────────────────────────
	border: 'rgba(255, 255, 255, 0.08)',

	// ── Scrollbar ─────────────────────────────────────────────
	scrollbarThumb: 'rgba(255, 255, 255, 0.15)',
	scrollbarTrack: 'transparent',

	// ── Animation ─────────────────────────────────────────────
	transitionSpeed: '0.2s',

	// ── Status colours ────────────────────────────────────────
	green: '#00d68f',
	red: '#ff3d71'
} as const;
