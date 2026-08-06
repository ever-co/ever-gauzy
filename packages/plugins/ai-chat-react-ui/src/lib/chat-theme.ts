/**
 * Design tokens for the AI Chat sidebar panel.
 *
 * Theme-adaptive: text and surface tones derive from `currentColor` via
 * `color-mix()`, so the panel works on both light and dark Nebular themes.
 * The Angular layout sets the base `color` on the sidebar surface
 * (see one-column.layout.scss), and everything here follows it.
 *
 * The chat panel renders as a dedicated sidebar between the nav menu
 * and the main page content area: `Menu | Chat | Canvas`.
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
	assistantBubbleBg: 'color-mix(in srgb, currentColor 7%, transparent)',
	assistantBubbleText: 'inherit',
	bubbleRadius: '12px',

	// ── Input ─────────────────────────────────────────────────
	inputBg: 'color-mix(in srgb, currentColor 5%, transparent)',
	inputBorder: 'color-mix(in srgb, currentColor 15%, transparent)',
	inputFocusBorder: 'color-mix(in srgb, currentColor 30%, transparent)',
	inputText: 'inherit',
	inputPlaceholder: 'color-mix(in srgb, currentColor 40%, transparent)',
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

	// ── Text (relative to the themed surface color) ───────────
	textPrimary: 'inherit',
	textSecondary: 'color-mix(in srgb, currentColor 60%, transparent)',
	textHint: 'color-mix(in srgb, currentColor 40%, transparent)',

	// ── Borders / dividers ────────────────────────────────────
	border: 'color-mix(in srgb, currentColor 12%, transparent)',

	// ── Surfaces (cards, code) ────────────────────────────────
	surface: 'color-mix(in srgb, currentColor 4%, transparent)',
	surfaceDeep: 'color-mix(in srgb, currentColor 10%, transparent)',

	// ── Scrollbar ─────────────────────────────────────────────
	scrollbarThumb: 'color-mix(in srgb, currentColor 20%, transparent)',
	scrollbarTrack: 'transparent',

	// ── Animation ─────────────────────────────────────────────
	transitionSpeed: '0.2s',

	// ── Status colours ────────────────────────────────────────
	green: '#00d68f',
	red: '#ff3d71',
	/** Tinted red for an ACTIVE destructive-ish control (the mic while recording). */
	redSoft: 'color-mix(in srgb, #ff3d71 16%, transparent)',
	/** Quiet foreground for secondary controls, so they do not compete with Send. */
	textMuted: 'color-mix(in srgb, currentColor 55%, transparent)'
} as const;
