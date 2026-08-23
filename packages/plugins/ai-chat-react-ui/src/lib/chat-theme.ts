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
	userBubbleBg: '#6E49E8',
	userBubbleText: 'rgba(255, 255, 255, 0.95)',
	assistantBubbleBg: 'color-mix(in srgb, currentColor 6%, transparent)',
	/**
	 * Never the raw surface color: at full strength on a dark theme that reads as pure
	 * white and glares against the muted panel around it. This is the bubble's *strong*
	 * tone — headings and bold runs sit here, body copy is dimmed one more step
	 * (`textBody`) so the hierarchy is brightness as well as size.
	 */
	assistantBubbleText: 'color-mix(in srgb, currentColor 92%, transparent)',
	bubbleRadius: '14px',
	/** The corner that points at the speaker — kept tight so the bubble has a direction. */
	bubbleRadiusTight: '5px',

	// ── Input ─────────────────────────────────────────────────
	inputBg: 'color-mix(in srgb, currentColor 5%, transparent)',
	inputBorder: 'color-mix(in srgb, currentColor 15%, transparent)',
	inputFocusBorder: 'color-mix(in srgb, currentColor 30%, transparent)',
	inputFocusRing: '0 0 0 3px rgba(51, 102, 255, 0.14)',
	inputText: 'inherit',
	inputPlaceholder: 'color-mix(in srgb, currentColor 40%, transparent)',
	inputRadius: '12px',
	/** Radius for the small square controls that sit inside the composer. */
	controlRadius: '8px',

	// ── Accent ────────────────────────────────────────────────
	accent: '#3366ff',
	accentHover: '#598bff',
	accentLight: 'rgba(51, 102, 255, 0.15)',

	// ── Typography ────────────────────────────────────────────
	fontFamily: 'inherit',
	fontFamilyMono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
	fontSizeSmall: '0.75rem',
	fontSizeBase: '0.8125rem',
	fontSizeLarge: '0.875rem',
	fontSizeMessage: '11px',
	/** What you type. Pinned in px, not rem: the composer is a fixed 13px by design. */
	fontSizeInput: '13px',
	/** Generous leading is what keeps 10px body copy readable. */
	lineHeightMessage: 1.75,
	fontWeightMedium: 500,
	fontWeightSemibold: 600,

	// ── Text (relative to the themed surface color) ───────────
	textPrimary: 'inherit',
	textSecondary: 'color-mix(in srgb, currentColor 60%, transparent)',
	textHint: 'color-mix(in srgb, currentColor 40%, transparent)',
	/**
	 * Body copy inside a message. Applied to the paragraph/list/cell elements rather than
	 * to the bubble, so headings and bold runs keep the brighter bubble tone above it.
	 */
	textBody: 'color-mix(in srgb, currentColor 91%, transparent)',

	// ── Borders / dividers ────────────────────────────────────
	border: 'color-mix(in srgb, currentColor 12%, transparent)',
	borderSoft: 'color-mix(in srgb, currentColor 8%, transparent)',

	// ── Surfaces (cards, code) ────────────────────────────────
	surface: 'color-mix(in srgb, currentColor 4%, transparent)',
	surfaceDeep: 'color-mix(in srgb, currentColor 10%, transparent)',

	// ── Markdown / structured content ─────────────────────────
	codeBg: 'color-mix(in srgb, currentColor 6%, transparent)',
	codeBorder: 'color-mix(in srgb, currentColor 11%, transparent)',
	codeText: 'color-mix(in srgb, currentColor 82%, transparent)',
	inlineCodeBg: 'color-mix(in srgb, currentColor 10%, transparent)',
	quoteBar: 'color-mix(in srgb, currentColor 22%, transparent)',
	/**
	 * Links blend the accent toward the surrounding text color, so they darken on a light
	 * theme and lighten on a dark one instead of vibrating against either.
	 */
	link: 'color-mix(in srgb, #3366ff 72%, currentColor)',

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
