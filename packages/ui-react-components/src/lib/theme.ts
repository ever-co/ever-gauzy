// ─── Design tokens ────────────────────────────────────────────────────────────
//
// These are the values the React dashboard paints with, and they used to be
// nine hex literals: the light theme's text colours, a white card, a #edf1f7
// hairline, and Nebular's four saturated status FILLS (#3366ff / #ff3d71 /
// #ffaa00 / #00d68f). Two problems followed from that.
//
// One, the React tab is a tab in the SAME dashboard as the Angular ones, and it
// is the only one that does not move with the theme: on any of the four dark
// themes it kept painting near-black text on a white card in the middle of a
// dark page. Two, the status fills are meant to sit UNDER white text; used as
// bar and dot colours next to muted labels they were the loudest thing on a page
// whose Angular siblings had just been quietened.
//
// Every value is now a reference to the custom property the active Nebular theme
// publishes, which is the same token the Angular tabs resolve — so the two sides
// of the dashboard are drawn from one palette and both follow the theme. These
// are consumed from inline `style` props, where `var()` resolves exactly as it
// does in a stylesheet.
//
// The literal after each `var()` is a FALLBACK for the component being rendered
// outside a themed layout (a Storybook page, a unit test): it is the light
// theme's value, i.e. what this file used to hard-code.
export const theme = {
	textPrimary: 'var(--gauzy-text-color-1, #222b45)',
	textSecondary: 'var(--gauzy-text-color-2, #8f9bb3)',
	// Was `#c5cee0` — a light-theme DIVIDER colour used as body text, which is
	// around 1.9:1 on white. The hint token is a text colour and is tuned per
	// canvas.
	textHint: 'var(--text-hint-color, #8f9bb3)',
	bg: 'var(--gauzy-card-1, #ffffff)',
	bgCard2: 'var(--gauzy-card-2, rgba(50, 50, 50, 0.02))',
	border: 'var(--gauzy-border-default-color, rgba(126, 126, 143, 0.1))',
	// The accents. `gauzy-action-*-text` rather than `color-*-default`: those are
	// fill colours, and this app uses them for glyphs, bars and dots, where the
	// contrast-tuned text variants are what stay legible on both canvases.
	blue: 'var(--gauzy-action-info-text, #1d4ed8)',
	red: 'var(--gauzy-action-danger-text, #dc2626)',
	orange: 'var(--gauzy-action-warning-text, #b45309)',
	green: 'var(--gauzy-action-success-text, #047857)',
	// The one accent that is a FILL: the theme's primary, used where a bar or a
	// control is the coloured object rather than the text on it.
	accent: 'var(--color-primary-default, #6e49e8)',
	// A neutral track/tint that darkens a light surface and lightens a dark one,
	// so one value works on every theme.
	tint: 'var(--gauzy-hover-tint, rgba(126, 126, 143, 0.12))',
	// Dashboard panels take the app's hairline rather than a drop shadow — see
	// the same change on the Angular tabs.
	shadow: 'none',
	shadowLight: 'none',
	radius: 'var(--border-radius, 0.625rem)',
	radiusSm: 'var(--gauzy-radius-sm, 0.375rem)',
	font: 'inherit'
};
