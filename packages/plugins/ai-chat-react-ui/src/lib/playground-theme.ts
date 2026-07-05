/**
 * Design tokens for the AI Playground layout.
 *
 * Light theme matching the Vercel AI SDK Playground aesthetic —
 * clean, minimal, enterprise-class. Separate from `chatTheme`
 * which targets the dark sidebar chat panel.
 */
export const playgroundTheme = {
	// ── Text ──────────────────────────────────────────────────
	textPrimary: '#222b45',
	textSecondary: '#8f9bb3',
	textHint: '#c5cee0',

	// ── Backgrounds ──────────────────────────────────────────
	bg: '#ffffff',
	bgSubtle: '#fafbfc',
	bgInput: 'rgba(50, 50, 50, 0.02)',

	// ── Borders ──────────────────────────────────────────────
	border: '#edf1f7',
	borderFocus: '#3366ff',

	// ── Accent ───────────────────────────────────────────────
	accent: '#3366ff',
	accentHover: '#598bff',
	accentSubtle: 'rgba(51, 102, 255, 0.08)',

	// ── Status ───────────────────────────────────────────────
	red: '#ff3d71',
	green: '#00d68f',
	orange: '#ffaa00',

	// ── Elevation ────────────────────────────────────────────
	shadow: '0 0.5rem 1rem 0 rgba(44, 51, 73, 0.08)',
	shadowLight: '0px 6px 20px 0px rgba(0, 0, 0, 0.05)',

	// ── Shape ────────────────────────────────────────────────
	radius: '0.5rem',
	radiusLg: '0.75rem',

	// ── Typography ───────────────────────────────────────────
	font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
	fontMono: "'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
	fontSizeXs: '0.6875rem',
	fontSizeSm: '0.8125rem',
	fontSizeBase: '0.875rem',
	fontSizeLg: '0.9375rem',

	// ── Sizing ───────────────────────────────────────────────
	headerHeight: '3rem',
	settingsPanelWidth: '300px',

	// ── Animation ────────────────────────────────────────────
	transition: '150ms ease'
} as const;
