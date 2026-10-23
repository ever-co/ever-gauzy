/**
 * The dashboard's stylesheet — one `<style>` block injected by the root component (precedent:
 * `ai-chat-react-ui/.../AiChatPanel.tsx`), class-prefixed `gz-rtt-`.
 *
 * It is a plain-CSS transcription of the Angular tab's SCSS — `time-tracking.component.scss`,
 * `_swiper.scss`, `widget.component.scss`, `window.component.scss`, `window-layout.component.scss`,
 * `screenshots-item.component.scss`, `timezone-filter.component.scss` — with `nb-theme(x)`
 * written as `var(--x)`, so it follows the active theme like the originals. Nebular's own
 * card/list/button/icon theme rules are NOT copied: the markup uses the real `nb-card` /
 * `nb-list-item` / `[nbButton]` / `nb-icon` hooks and inherits them from the global stylesheet.
 *
 * Keep it in step with those files: when the Angular tab is restyled, this copy has to follow,
 * or the two "Preferred UI" flavours drift apart.
 */
export const TIME_TRACKING_STYLES = `
/* ── Nebular component :host layout (encapsulated in Angular, re-declared here) ── */
.gz-rtt nb-card { display: flex; flex-direction: column; position: relative; }
.gz-rtt nb-list { display: block; overflow: auto; }
.gz-rtt nb-list-item { display: flex; align-items: center; flex-shrink: 0; }
.gz-rtt nb-icon, .gz-rtt-hdr nb-icon { display: inline-block; }
.gz-rtt nb-icon svg, .gz-rtt-hdr nb-icon svg { vertical-align: top; width: 100%; height: 100%; }

/* ── Page card body (time-tracking.component.scss :host / .container) ── */
.gz-rtt { display: block; }
.gz-rtt .gz-rtt-container { max-width: unset; padding: 0; border-radius: 0 0 var(--border-radius) var(--border-radius); }

/* Cards inside the dashboard: :host nb-card { … } */
.gz-rtt nb-card { background-color: var(--background-basic-color-1); box-shadow: 0px 6px 20px 0px rgb(0 0 0 / 5%); border-radius: var(--border-radius); margin: 0; }
.gz-rtt nb-card-body, .gz-rtt nb-list { border-radius: 0 0 var(--border-radius) var(--border-radius); }
.gz-rtt .gz-rtt-custom-card-body-inner, .gz-rtt .gz-rtt-custom-card-body-inner-list { background-color: var(--gauzy-card-2); }
.gz-rtt .gz-rtt-custom-card-body-inner { padding-top: 0.75rem; }
.gz-rtt .gz-rtt-font-weight-bold { font-weight: 600; color: var(--gauzy-text-color-2); text-transform: none; }
.gz-rtt .gz-rtt-project-name { color: var(--gauzy-text-color-1); font-size: 12px; font-weight: 500; line-height: var(--gauzy-table-line-height);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt [nbbutton].appearance-outline.status-primary { background-color: unset; font-size: var(--text-label-font-size); font-weight: 500; line-height: 1rem;
	letter-spacing: 0em; border-color: var(--gauzy-background-transparent); color: var(--button-outline-primary-text-color); border-width: 1px;
	height: 1.75rem; padding: 0 0.625rem; white-space: nowrap; }
.gz-rtt .gz-rtt-link-text { cursor: pointer; text-decoration: none; color: #1e6bb8; font-size: small; }

/* Bootstrap-ish grid the Angular templates rely on (row / col-*) — only what the windows use. */
.gz-rtt .gz-rtt-row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
.gz-rtt .gz-rtt-row > * { padding-right: 15px; padding-left: 15px; box-sizing: border-box; }
.gz-rtt .gz-rtt-col { flex-basis: 0; flex-grow: 1; max-width: 100%; min-width: 0; }
.gz-rtt .gz-rtt-col-3 { flex: 0 0 25%; max-width: 25%; }
.gz-rtt .gz-rtt-col-4 { flex: 0 0 33.333333%; max-width: 33.333333%; }
.gz-rtt .gz-rtt-col-5 { flex: 0 0 41.666667%; max-width: 41.666667%; }
.gz-rtt .gz-rtt-align-items-center { align-items: center; }
.gz-rtt .gz-rtt-w-100 { width: 100%; }
.gz-rtt .gz-rtt-d-flex { display: flex; }

/* ── Header action strip (time-tracking.component.scss .page-header__actions) ──
   Every control shares one chip: control height, label size, card-1 fill and a 1px inset ring. */
.gz-rtt-hdr { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.5rem; }
.gz-rtt-hdr .gz-rtt-toolbar { display: contents; }
.gz-rtt-hdr .gz-rtt-refresh[nbbutton], .gz-rtt-hdr .gz-rtt-popover-button[nbbutton], .gz-rtt-hdr .gz-rtt-manage-widget[nbbutton] {
	height: var(--gauzy-header-control-height, 1.75rem); min-width: 0; padding-block: 0; padding-inline: 0.625rem;
	font-size: var(--text-label-font-size); font-weight: 500; line-height: 1rem; white-space: nowrap; text-transform: none;
	display: inline-flex; align-items: center; gap: 0.375rem;
	color: var(--gauzy-text-color-2); background-color: var(--gauzy-card-1); border: none;
	box-shadow: inset 0 0 0 1px var(--gauzy-overlay-border-color, rgba(126, 126, 143, 0.18)); border-radius: var(--gauzy-radius-sm, 0.375rem);
	transition: background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease; }
.gz-rtt-hdr .gz-rtt-refresh[nbbutton]:hover:not([disabled]), .gz-rtt-hdr .gz-rtt-popover-button[nbbutton]:hover:not([disabled]),
.gz-rtt-hdr .gz-rtt-manage-widget[nbbutton]:hover:not([disabled]) { background-color: var(--gauzy-hover-tint); color: var(--gauzy-text-color-1); }
.gz-rtt-hdr .gz-rtt-refresh[nbbutton][disabled], .gz-rtt-hdr .gz-rtt-popover-button[nbbutton][disabled], .gz-rtt-hdr .gz-rtt-manage-widget[nbbutton][disabled] {
	background-color: transparent; box-shadow: inset 0 0 0 1px var(--gauzy-border-default-color); color: var(--gauzy-text-color-2); opacity: 0.55; cursor: not-allowed; }
.gz-rtt-hdr .gz-rtt-refresh[nbbutton] nb-icon, .gz-rtt-hdr .gz-rtt-popover-button[nbbutton] nb-icon, .gz-rtt-hdr .gz-rtt-manage-widget[nbbutton] nb-icon {
	font-size: 1rem; width: 1rem; height: 1rem; margin: 0; flex: 0 0 auto; }
@media screen and (max-width: 36rem) {
	.gz-rtt-hdr .gz-rtt-refresh .gz-rtt-action-label, .gz-rtt-hdr .gz-rtt-manage-widget .gz-rtt-action-label { display: none; }
	.gz-rtt-hdr .gz-rtt-refresh[nbbutton], .gz-rtt-hdr .gz-rtt-manage-widget[nbbutton] { padding-inline: 0.5rem; gap: 0; }
	/* A timezone label is ~300px of nowrap text — clipped, it still shows the zone abbreviation. */
	.gz-rtt-hdr .gz-rtt-popover-button[nbbutton] > div { max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* nb-toggle look (toggle.component.scss + _toggle.component.theme.scss, size small = the app tokens) */
.gz-rtt-toggle { display: inline-flex; align-items: center; gap: 0.375rem; height: var(--gauzy-header-control-height, 1.75rem);
	cursor: var(--toggle-cursor, pointer); margin: 0; user-select: none; }
.gz-rtt-toggle .gz-rtt-toggle-input { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
.gz-rtt-toggle .gz-rtt-toggle-track { position: relative; display: inline-flex; align-items: center; box-sizing: content-box;
	height: var(--toggle-height); width: var(--toggle-width); border-width: var(--toggle-border-width); border-style: solid;
	border-radius: var(--toggle-border-radius); background-color: var(--toggle-basic-background-color); border-color: var(--toggle-basic-border-color);
	transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s; }
.gz-rtt-toggle .gz-rtt-toggle-track.checked { background-color: var(--toggle-basic-checked-background-color); border-color: var(--toggle-basic-checked-border-color); }
.gz-rtt-toggle .gz-rtt-toggle-input:enabled:focus-visible + .gz-rtt-toggle-track { box-shadow: 0 0 0 var(--toggle-outline-width) var(--toggle-outline-color); }
.gz-rtt-toggle .gz-rtt-toggle-switcher { position: absolute; border-radius: 50%; margin: 1px; width: var(--toggle-switcher-size); height: var(--toggle-switcher-size);
	background-color: var(--toggle-basic-switcher-background-color, var(--background-basic-color-1)); left: 0; transition: left 0.15s ease; }
.gz-rtt-toggle .gz-rtt-toggle-track.checked .gz-rtt-toggle-switcher { left: calc(100% - var(--toggle-switcher-size) - 2px);
	background-color: var(--toggle-basic-checked-switcher-background-color); }
.gz-rtt-toggle .gz-rtt-toggle-text { padding: 0; color: var(--gauzy-text-color-2); font-family: var(--toggle-text-font-family);
	font-size: var(--text-label-font-size); font-weight: 500; line-height: 1rem; white-space: nowrap; }

/* Popover bodies (timezone-filter.component.scss .popover-body / time-tracking .widget-popover) */
.gz-rtt-popover-body { display: flex; flex-direction: column; align-items: flex-start; padding: 10px; gap: 10px; min-width: 150px; }
.gz-rtt-widget-popover { display: flex; flex-direction: column; align-items: flex-start; padding: 0.75rem; gap: 0.75rem; min-width: 219px; max-width: 17rem; }
.gz-rtt-popover-body .gz-rtt-category { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; width: 100%; }
.gz-rtt-widget-popover .gz-rtt-category { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; width: 100%; }
.gz-rtt-popover-body .gz-rtt-view, .gz-rtt-widget-popover .gz-rtt-view { font-size: 10px; font-weight: 600; line-height: 12px; letter-spacing: 0em;
	color: rgba(126, 126, 143, 0.5); align-items: center; display: flex; justify-content: space-between; gap: 1rem; width: 100%; }
.gz-rtt-widget-popover .gz-rtt-view { text-transform: uppercase; }
.gz-rtt-popover-body .gz-rtt-title { font-size: var(--gauzy-table-header-font-size); font-weight: 400; line-height: var(--gauzy-table-header-line-height);
	letter-spacing: 0em; color: var(--gauzy-text-color-2); display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%;
	background: none; border: 0; padding: 0; text-align: start; font-family: inherit; }
.gz-rtt-widget-popover .gz-rtt-title { font-size: var(--text-label-font-size); font-weight: 400; line-height: 1rem; letter-spacing: 0em;
	color: var(--gauzy-text-color-2); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; width: 100%; min-width: 0;
	padding: 0.25rem 0.375rem; border: 0; border-radius: var(--gauzy-radius-sm, 0.375rem); background: none; text-align: start; font-family: inherit;
	transition: background-color 0.15s ease-in-out; }
.gz-rtt-popover-body .gz-rtt-title:hover { color: var(--gauzy-text-color-1); }
.gz-rtt-widget-popover .gz-rtt-title:hover { background-color: var(--gauzy-hover-tint); color: var(--gauzy-text-color-1); }
.gz-rtt-popover-body .gz-rtt-title i { width: 12px; }
.gz-rtt-widget-popover .gz-rtt-title i { flex: 0 0 0.75rem; font-size: 0.6875rem; text-align: center; }
.gz-rtt-widget-popover .gz-rtt-title .gz-rtt-title-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt-popover-body .gz-rtt-line { border-bottom: 0.5px solid rgba(126, 126, 143, 0.25); width: 100%; }
.gz-rtt-widget-popover .gz-rtt-line { border-bottom: 1px solid var(--gauzy-border-default-color); width: 100%; }
/* Compact ghost Undo (time-tracking.component.scss .manage-widget.undo) */
.gz-rtt-widget-popover .gz-rtt-undo[nbbutton] { display: inline-flex; align-items: center; gap: 0.25rem; height: 1.5rem; min-width: 0; padding: 0 0.5rem;
	font-size: 0.6875rem; font-weight: 500; line-height: 1; text-transform: none; color: var(--gauzy-text-color-2); background-color: transparent;
	border: none; box-shadow: none; border-radius: var(--gauzy-radius-sm, 0.375rem); transition: background-color 0.15s ease, color 0.15s ease; }
.gz-rtt-widget-popover .gz-rtt-undo[nbbutton]:hover:not([disabled]), .gz-rtt-widget-popover .gz-rtt-undo[nbbutton]:focus-visible {
	background-color: var(--gauzy-hover-tint); color: var(--gauzy-text-color-1); }
.gz-rtt-widget-popover .gz-rtt-undo[nbbutton] i { font-size: 0.625rem; }
.gz-rtt-widget-popover .gz-rtt-undo[disabled] { opacity: 0.5; }

/* ── Overview widgets (time-tracking.component.scss ga-widget-layout) ──
   A grid, not fixed widths: auto-fit reflows on the container, so the row stays even whether
   the sidebar is open or collapsed, and drops to fewer columns on a narrow card. */
.gz-rtt .gz-rtt-widgets { display: grid; grid-template-columns: repeat(auto-fit, minmax(13.75rem, 1fr)); align-items: stretch; gap: 1rem; margin: 0 0 1rem; }
.gz-rtt .gz-rtt-widget-drop { display: block; min-width: 0; }
.gz-rtt .gz-rtt-widget { position: relative; color: var(--gauzy-text-color-2); width: 100%; min-width: 0; height: 100%; margin: 0; cursor: pointer; }
.gz-rtt .gz-rtt-widget > nb-card { height: 100%; margin: 0; border: 1px solid var(--gauzy-border-default-color); }
.gz-rtt .gz-rtt-widget nb-card-body { display: flex; flex-direction: column; padding: 0.75rem; }
.gz-rtt .gz-rtt-widget.collapsed nb-card-body div.h1 { display: none; }
.gz-rtt .gz-rtt-widget.expanded nb-card-body div.h1 { display: block; }
.gz-rtt .gz-rtt-widget .gz-rtt-item-menu { font-size: 11px; position: absolute; right: 12px; top: 10.5px; z-index: 2; }
[dir='rtl'] .gz-rtt .gz-rtt-widget .gz-rtt-item-menu { right: auto; left: 12px; }
.gz-rtt .gz-rtt-widget nb-card-body > .gz-rtt-header-widget { font-size: var(--text-label-font-size); font-weight: 500; line-height: 1rem; letter-spacing: -0.009em;
	color: var(--gauzy-text-color-2); margin-bottom: 0.375rem; min-width: 0; }
.gz-rtt .gz-rtt-widget .gz-rtt-header-widget .gz-rtt-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-inline-end: 1.25rem; }
.gz-rtt .gz-rtt-widget .h1 { margin-bottom: 0; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Pushed to the bottom of the card, so the bars line up across the row. */
.gz-rtt .gz-rtt-counter-container { width: 100%; margin-top: auto; padding-top: 0.5rem; }

/* ── Windows masonry (window-layout.component.scss / window.component.scss) ── */
.gz-rtt .gz-rtt-windows { column-count: 2; column-gap: 1rem; }
@media only screen and (max-width: 1200px) { .gz-rtt .gz-rtt-windows { column-count: 1; } }
.gz-rtt .gz-rtt-window-drop { break-inside: avoid; }
.gz-rtt .gz-rtt-window { position: relative; color: var(--gauzy-text-color-2); display: inline-block; width: 100%; box-sizing: border-box;
	margin-bottom: 1rem; cursor: pointer; }
.gz-rtt .gz-rtt-window.collapsed nb-card-body { display: none; }
.gz-rtt .gz-rtt-window.expanded nb-card-body { display: block; }
.gz-rtt .gz-rtt-window .gz-rtt-item-menu { font-size: 11px; position: absolute; right: 1rem; top: 1.125rem; z-index: 2; }
[dir='rtl'] .gz-rtt .gz-rtt-window .gz-rtt-item-menu { right: auto; left: 1rem; }

/* Window header: title + optional action, with room on the end for the ⋮ menu. */
.gz-rtt nb-card-header.gz-rtt-window-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
	padding-block: 0.75rem; padding-inline-start: 0.75rem; padding-inline-end: 2.25rem; }
.gz-rtt .gz-rtt-window-header-title { font-size: var(--text-subtitle-2-font-size); font-weight: 600; line-height: 1.125rem; letter-spacing: -0.009em;
	color: var(--gauzy-text-color-2); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt .gz-rtt-window-header-action { flex: 0 0 auto; display: inline-flex; }
.gz-rtt nb-card-body.gz-rtt-window-body { padding: 0 0.75rem 0.75rem; overflow: unset; }
.gz-rtt nb-card-body.gz-rtt-custom-card-body-inner.gz-rtt-window-body { padding-top: 0.75rem; }
.gz-rtt .gz-rtt-custom-card-body-inner > .gz-rtt-row { margin-inline: 0; }
.gz-rtt .gz-rtt-custom-card-body-inner > .gz-rtt-row > .gz-rtt-col { padding-inline: 0; }
.gz-rtt .gz-rtt-custom-card-body-inner > .gz-rtt-row + .gz-rtt-row { margin-top: 1rem; }
.gz-rtt .gz-rtt-window-empty { display: flex; align-items: center; justify-content: center; text-align: center; min-height: 5rem; padding: 0.75rem;
	font-size: var(--gauzy-table-font-size); line-height: var(--gauzy-table-line-height); color: var(--gauzy-text-color-2); }

/* Shared: the ⋮ trigger, moving state, drag & drop feedback */
.gz-rtt .gz-rtt-item-menu-btn { background: none; border: 0; padding: 0; margin: 0; cursor: pointer; color: inherit; line-height: 1;
	display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 4px; }
.gz-rtt .gz-rtt-item-menu-btn:hover { background: var(--gauzy-sidebar-background-3); }
.gz-rtt .gz-rtt-item-menu-btn nb-icon { width: 11px; height: 11px; font-size: 11px; }
.gz-rtt .gz-rtt-item-menu-btn:focus-visible { outline: 2px solid var(--color-primary-transparent-300); outline-offset: 1px; }
.gz-rtt .moved nb-card { cursor: move; }
.gz-rtt .gz-rtt-dragging { opacity: 0.4; }
.gz-rtt .gz-rtt-drag-over > nb-card, .gz-rtt .gz-rtt-drag-over nb-card { outline: 2px dashed var(--color-primary-transparent-500); outline-offset: 2px; }
.gz-rtt .gz-rtt-widget.gz-rtt-drag-over nb-card nb-card-body { background-color: var(--gauzy-sidebar-background-3); border-radius: var(--border-radius); }
.gz-rtt .gz-rtt-window.gz-rtt-drag-over nb-card nb-card-body { background-color: var(--gauzy-sidebar-background-3); }

/* ⋮ settings menu (widget.component.scss .setting) */
.gz-rtt-setting { display: flex; flex-direction: column; padding: 10px 12px; gap: 10px; }
.gz-rtt-setting .gz-rtt-action { display: flex; gap: 10px; align-items: center; cursor: pointer; background: none; border: 0; padding: 0; text-align: start; font: inherit; }
.gz-rtt-setting .gz-rtt-action i { font-size: 12px; color: var(--gauzy-text-color-2); width: 14px; text-align: center; }
.gz-rtt-setting .gz-rtt-action span { color: rgba(126, 126, 143, 0.5); font-size: 12px; }
.gz-rtt-setting .gz-rtt-action:hover span { color: var(--gauzy-text-color-2); }

/* ── Table-style rows (time-tracking.component.scss .data-list / .cell / .progress-cell) ── */
.gz-rtt .gz-rtt-data-list { --gz-rtt-row-padding-block: 0.875rem; }
.gz-rtt .gz-rtt-data-list nb-list-item { padding: var(--gz-rtt-row-padding-block) var(--gauzy-table-cell-padding-x); font-size: var(--gauzy-table-font-size);
	line-height: var(--gauzy-table-line-height); color: var(--gauzy-text-color-1); border-bottom: 1px solid var(--gauzy-border-default-color);
	transition: background-color 0.15s ease-in-out; }
.gz-rtt .gz-rtt-data-list nb-list-item:last-child { border-bottom: none; }
.gz-rtt .gz-rtt-data-list nb-list-item:hover { background-color: var(--gauzy-hover-tint); }
.gz-rtt .gz-rtt-data-list nb-list-item.gz-rtt-data-list-head { padding: var(--gauzy-table-header-padding-y) var(--gauzy-table-header-padding-x);
	font-size: var(--gauzy-table-header-font-size); line-height: var(--gauzy-table-header-line-height); background-color: var(--gauzy-card-3);
	border-radius: var(--gauzy-radius-sm, 0.375rem); border-bottom: none; margin-bottom: 2px; }
.gz-rtt .gz-rtt-data-list nb-list-item.gz-rtt-data-list-head:hover { background-color: var(--gauzy-card-3); }
.gz-rtt .gz-rtt-data-list .gz-rtt-row { margin-inline: 0; align-items: center; row-gap: 0.25rem; }
.gz-rtt .gz-rtt-manual-time-list nb-list-item:not(.gz-rtt-data-list-head), .gz-rtt .gz-rtt-projects-list nb-list-item,
.gz-rtt .gz-rtt-apps-urls-list nb-list-item { font-size: 12px; }
.gz-rtt .gz-rtt-cell { min-width: 0; padding-inline: 0.375rem; color: var(--gauzy-text-color-1); }
.gz-rtt .gz-rtt-row > .gz-rtt-cell { padding-inline: 0.375rem; }
.gz-rtt .gz-rtt-cell-centered { text-align: center; }
.gz-rtt .gz-rtt-cell-clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt .gz-rtt-cell-figure, .gz-rtt .gz-rtt-cell-numeric { font-variant-numeric: tabular-nums; color: var(--gauzy-text-color-2); }
.gz-rtt .gz-rtt-cell-numeric { text-align: end; }
.gz-rtt .gz-rtt-font-weight-bold .gz-rtt-cell { color: var(--gauzy-text-color-2); }
/* Avatar chips in table cells: the image never shrinks, the name ellipsizes instead. */
.gz-rtt .gz-rtt-cell .gzrc-avatar, .gz-rtt .gz-rtt-cell .gzrc-avatar-inner, .gz-rtt .gz-rtt-cell .gzrc-avatar-names { min-width: 0; }
.gz-rtt .gz-rtt-cell .gzrc-avatar-image { flex: 0 0 auto; }
.gz-rtt .gz-rtt-manual-time-list .gz-rtt-col-3.gz-rtt-cell .gzrc-avatar-name,
.gz-rtt .gz-rtt-manual-time-list .gz-rtt-col-3.gz-rtt-cell .gzrc-avatar-caption { font-size: 12px; }
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-cell .gzrc-avatar-name { font-size: var(--gauzy-table-header-font-size); }
.gz-rtt .gz-rtt-progress-cell { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.gz-rtt .gz-rtt-progress-cell-value { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-size: var(--gauzy-table-header-font-size);
	color: var(--gauzy-text-color-2); min-width: 2.25rem; text-align: end; }
.gz-rtt .gz-rtt-progress-cell .gz-rtt-custom-progress { flex: 1 1 auto; min-width: 0; margin: 0; }

/* Apps & URLs rows: the same title / progress / duration split as Projects and Tasks. */
.gz-rtt .gz-rtt-activity-item { display: flex; flex-wrap: nowrap; align-items: center; cursor: pointer; }
.gz-rtt .gz-rtt-activity-item > * { min-width: 0; padding-inline: 0.375rem; box-sizing: border-box; font-size: 12px; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-title { flex: 0 0 41.6667%; max-width: 41.6667%; font-weight: 500; line-height: var(--gauzy-table-line-height);
	color: var(--gauzy-text-color-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-progress { flex: 0 0 33.3333%; max-width: 33.3333%; display: flex; align-items: center; gap: 0.5rem; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-progress .gz-rtt-tracking-progress { flex: 1 1 auto; min-width: 0; margin: 0; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-duration { flex: 1 1 auto; max-width: none; text-align: end; line-height: var(--gauzy-table-line-height);
	font-variant-numeric: tabular-nums; color: var(--gauzy-text-color-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Members window */
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-data-list { --gz-rtt-row-padding-block: 0.625rem; }
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-list { max-height: 65vh; overflow-y: auto; padding-inline-end: 0.25rem; }
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-window-header-title { font-size: var(--gauzy-table-header-font-size); line-height: var(--gauzy-table-header-line-height); }
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-window-empty { font-size: var(--gauzy-table-header-font-size); }
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-data-list nb-list-item:not(.gz-rtt-data-list-head) { font-size: var(--gauzy-table-header-font-size); }
.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-activity .gz-rtt-duration { font-size: var(--gauzy-table-header-font-size); font-weight: 400; color: var(--gauzy-text-color-2); }
.gz-rtt .gz-rtt-activity { display: flex; flex-direction: column; align-items: center; gap: var(--gauzy-table-chip-block-gap, 0.25rem); min-width: 0; }
.gz-rtt .gz-rtt-activity .gz-rtt-duration { font-variant-numeric: tabular-nums; font-size: var(--gauzy-table-font-size); line-height: var(--gauzy-table-line-height);
	color: var(--gauzy-text-color-1); white-space: nowrap; }
.gz-rtt .gz-rtt-activity .gz-rtt-activity-percentage { display: flex; }
.gz-rtt .gz-rtt-period-cell { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-width: 0; }
.gz-rtt .gz-rtt-member-weekly-activity-graph { display: flex; align-items: flex-end; gap: 2px; margin-inline-start: 0.625rem; height: 1.25rem; }
.gz-rtt .gz-rtt-member-weekly-activity-graph .gz-rtt-bar-graph-entry { width: 4px; border-radius: 1px; background-color: var(--color-info-default); min-height: 2px; }

/* ── Recent activities: avatar row + carousel (time-tracking .hour-label / _swiper.scss) ── */
.gz-rtt .gz-rtt-avatar-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.gz-rtt .gz-rtt-avatar-row > .gzrc-avatar { width: auto; flex: 0 1 auto; min-width: 0; }
.gz-rtt .gz-rtt-avatar-row > .gzrc-avatar .gzrc-avatar-inner, .gz-rtt .gz-rtt-avatar-row > .gzrc-avatar .gzrc-avatar-names { width: auto; min-width: 0; }
.gz-rtt .gz-rtt-avatar-row > .gzrc-avatar .gzrc-avatar-caption { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 16rem; }
.gz-rtt .gz-rtt-button-container { display: flex; align-items: center; gap: 0.5rem; flex: 0 0 auto; }
.gz-rtt .gz-rtt-swiper-button-container { display: flex; align-items: center; gap: 0.25rem; }
.gz-rtt .gz-rtt-swiper-button { width: 1.75rem; height: 1.75rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; font: inherit;
	box-shadow: inset 0 0 0 1px var(--gauzy-overlay-border-color, rgba(126, 126, 143, 0.18)); background-color: var(--gauzy-card-1);
	color: var(--gauzy-text-color-2); border-radius: var(--gauzy-radius-sm, 0.375rem); cursor: pointer; user-select: none;
	transition: background-color 0.15s ease, color 0.15s ease; }
.gz-rtt .gz-rtt-swiper-button i { font-weight: 600; font-size: 0.875rem; line-height: 1; }
.gz-rtt .gz-rtt-swiper-button:hover:not(:disabled) { background-color: var(--gauzy-hover-tint); color: var(--gauzy-text-color-1); }
.gz-rtt .gz-rtt-swiper-button:disabled { opacity: 0.4; cursor: default; }
.gz-rtt .gz-rtt-view-all { display: flex; align-items: center; }
.gz-rtt .gz-rtt-carousel-wrap { position: relative; display: block; width: 100%; min-width: 0; }
/* Swiper's clickable pagination, nudged down like the ::part(pagination) override. */
.gz-rtt .gz-rtt-carousel-pagination { position: absolute; left: 0; right: 0; bottom: -2px; display: flex; justify-content: center; align-items: center; gap: 8px;
	line-height: 0; z-index: 1; }
.gz-rtt .gz-rtt-carousel-bullet { width: 8px; height: 8px; padding: 0; margin: 0; border: 0; border-radius: 50%; background: #000; opacity: 0.2; cursor: pointer; }
.gz-rtt .gz-rtt-carousel-bullet.active { background-color: var(--text-primary-color); opacity: 1; }
.gz-rtt .gz-rtt-carousel-bullet:focus-visible { outline: 2px solid var(--color-primary-transparent-300); outline-offset: 2px; }
.gz-rtt .gz-rtt-carousel { overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; }
.gz-rtt .gz-rtt-carousel::-webkit-scrollbar { display: none; }
/* --gz-rtt-slide-gap is the single source for the cell gap: the track renders it, the slide
   width formula subtracts it, and the arrow buttons read it (ScreenshotCarousel.tsx).
   NOTE: no backticks anywhere in this file's CSS — it is one template literal. */
.gz-rtt .gz-rtt-carousel { --gz-rtt-slides: 3; --gz-rtt-slide-gap: 8px; }
.gz-rtt .gz-rtt-carousel-track { display: flex; gap: var(--gz-rtt-slide-gap); padding-bottom: 1rem; }
/* Three across while they fit, but never narrower than the screenshot card's own minimum: on a
   narrow canvas fewer slides show and the track scrolls. */
.gz-rtt .gz-rtt-carousel-slide { flex: 0 0 max(calc((100% - (var(--gz-rtt-slides) - 1) * var(--gz-rtt-slide-gap)) / var(--gz-rtt-slides)), 189px); min-width: 0; scroll-snap-align: start; }

/* ── Screenshot item (screenshots-item.component.scss + the dashboard's overrides of it) ── */
.gz-rtt .gz-rtt-shot { border-radius: var(--border-radius); background-color: var(--gauzy-card-1); box-shadow: inset 0 0 0 1px var(--gauzy-border-default-color);
	min-width: 0; max-width: none; display: flex; flex-direction: column; justify-content: center; border: unset; }
.gz-rtt .gz-rtt-shot:hover { box-shadow: inset 0 0 0 1px var(--gauzy-border-default-color), 0 8px 20px -12px rgba(0, 0, 0, 0.45); }
.gz-rtt .gz-rtt-shot.danger-bordered { border: 2px solid var(--color-danger-500) !important; box-shadow: none; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image { cursor: pointer; border-radius: var(--border-radius) var(--border-radius) 0 0; background-color: var(--gauzy-hover-tint);
	min-height: 130px; position: relative; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image img { width: 100%; height: 130px; border-radius: var(--border-radius) var(--border-radius) 0 0; object-fit: cover; display: block; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image img.default-image { object-fit: contain; box-sizing: border-box; padding: 2.5rem; opacity: 0.35; }
/* Hover scrim: dark behind the chips and where it meets the slot info, lighter through the middle. */
.gz-rtt .gz-rtt-shot .gz-rtt-shot-hover { padding: 0.5rem; display: flex; flex-direction: column; position: absolute; inset: 0;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0.74) 0%, rgba(0, 0, 0, 0.42) 42%, rgba(0, 0, 0, 0.74) 100%); opacity: 0; z-index: 9;
	align-items: center; justify-content: flex-start; transition: opacity 0.18s ease; border-radius: var(--border-radius) var(--border-radius) 0 0; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image:hover .gz-rtt-shot-hover, .gz-rtt .gz-rtt-shot .gz-rtt-shot-image:focus-within .gz-rtt-shot-hover { opacity: 1; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions { display: flex; align-items: center; width: 100%; gap: 0.375rem; flex: 0 0 auto; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions [nbbutton] { width: 1.5rem; height: 1.5rem; padding: 0; margin: 0; border-radius: var(--gauzy-radius-sm, 0.375rem); }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions [nbbutton] nb-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; margin: 0; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions .gz-rtt-ml-auto { margin-inline-start: auto; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-view { width: 100%; flex-grow: 1; display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center;
	gap: 0.375rem; transform: translateY(0.25rem); transition: transform 0.18s ease; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image:hover .gz-rtt-shot-view, .gz-rtt .gz-rtt-shot .gz-rtt-shot-image:focus-within .gz-rtt-shot-view { transform: translateY(0); }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-view [nbbutton] { height: 1.75rem; padding: 0 0.625rem; margin: 0; font-size: 12px; font-weight: 400; line-height: 16px;
	letter-spacing: -0.009em; text-align: center; justify-content: center; border-radius: var(--gauzy-radius-sm, 0.375rem); }
.gz-rtt .gz-rtt-shot .gz-rtt-no-image { padding: 8px; background: rgba(0, 0, 0, 0.6); color: #fff; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border-radius: 5px; text-align: center; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info { font-size: 14px; font-weight: 400; line-height: 11px; letter-spacing: 0em; text-align: left; padding: 0.75rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-time-span { margin: 0 0 0.5rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-inline-time-span { font-size: var(--gauzy-table-header-font-size); font-weight: 600; line-height: 1.125rem;
	color: var(--gauzy-text-color-1); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-caption { font-size: 11px; font-weight: 400; line-height: 1rem; letter-spacing: 0em; color: var(--gauzy-text-color-2);
	margin-top: 0.125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-activity-count { margin-top: 0.375rem; font-size: var(--gauzy-table-header-font-size); line-height: 1rem;
	color: var(--gauzy-text-color-2); font-variant-numeric: tabular-nums; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-progress { background-color: var(--gauzy-card-2); }
.gz-rtt .gz-rtt-shot .gz-rtt-mb-1 { margin-bottom: 0.25rem; }
@media (prefers-reduced-motion: reduce) {
	.gz-rtt .gz-rtt-shot .gz-rtt-shot-hover { transition: none; }
	.gz-rtt .gz-rtt-shot .gz-rtt-shot-view { transform: none; transition: none; }
}

/* ── Narrow layouts (time-tracking.component.scss: trim the chrome, keep the row shapes) ── */
@media screen and (max-width: 48rem) {
	.gz-rtt nb-card-header.gz-rtt-window-header { padding-block: 0.625rem; padding-inline-start: 0.625rem; padding-inline-end: 2rem; }
	.gz-rtt nb-card-body.gz-rtt-window-body { padding: 0 0.5rem 0.5rem; }
	.gz-rtt .gz-rtt-data-list { --gz-rtt-row-padding-block: 0.625rem; }
	.gz-rtt .gz-rtt-data-list nb-list-item, .gz-rtt .gz-rtt-data-list nb-list-item.gz-rtt-data-list-head { padding-inline: 0.375rem; }
	.gz-rtt .gz-rtt-cell, .gz-rtt .gz-rtt-row > .gz-rtt-cell, .gz-rtt .gz-rtt-activity-item > * { padding-inline: 0.25rem; }
	.gz-rtt .gz-rtt-progress-cell, .gz-rtt .gz-rtt-activity-item .gz-rtt-activity-progress { gap: 0.375rem; }
	.gz-rtt .gz-rtt-progress-cell-value { min-width: 2rem; }
	.gz-rtt .gz-rtt-member-weekly-activity-graph { display: none; }
	.gz-rtt nb-card.gz-rtt-member-list .gz-rtt-list { max-height: 55vh; }
	.gz-rtt .gz-rtt-avatar-row { gap: 0.5rem; }
}
@media screen and (max-width: 36rem) {
	.gz-rtt .gz-rtt-widgets { grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: 0.75rem; }
	.gz-rtt .gz-rtt-widget .h1 { font-size: 1.5rem; line-height: 2rem; }
}
`;
