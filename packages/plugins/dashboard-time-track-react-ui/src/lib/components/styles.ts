/**
 * The dashboard's stylesheet — one `<style>` block injected by the root component (precedent:
 * `ai-chat-react-ui/.../AiChatPanel.tsx`), class-prefixed `gz-rtt-`.
 *
 * It is a plain-CSS transcription of the Angular tab's SCSS — `time-tracking.component.scss`,
 * `_swiper.scss`, `widget.component.scss`, `widget-layout.component.scss`,
 * `window.component.scss`, `window-layout.component.scss`, `screenshots-item.component.scss`,
 * `activity-item.component.scss`, `timezone-filter.component.scss` — with `nb-theme(x)` written
 * as `var(--x)`, so it follows the active theme like the originals. Nebular's own card/list/
 * button/icon theme rules are NOT copied: the markup uses the real `nb-card` / `nb-list-item` /
 * `[nbButton]` / `nb-icon` hooks and inherits them from the global stylesheet.
 */
export const TIME_TRACKING_STYLES = `
/* ── Nebular component :host layout (encapsulated in Angular, re-declared here) ── */
.gz-rtt nb-card { display: flex; flex-direction: column; position: relative; }
.gz-rtt nb-list { display: block; overflow: auto; }
.gz-rtt nb-list-item { display: flex; align-items: center; flex-shrink: 0; }
.gz-rtt nb-icon, .gz-rtt-hdr nb-icon { display: inline-block; }
.gz-rtt nb-icon svg, .gz-rtt-hdr nb-icon svg { vertical-align: top; width: 100%; height: 100%; }

/* ── Page card body (time-tracking.component.scss :host / .container / .card-body) ── */
.gz-rtt { display: block; }
.gz-rtt .gz-rtt-container { max-width: unset; padding: 0 0.5rem 0 0; border-radius: 0 0 var(--border-radius) var(--border-radius); }
[dir='rtl'] .gz-rtt .gz-rtt-container { padding: 0 0 0 0.5rem; }

/* Cards inside the dashboard: :host nb-card { … } */
.gz-rtt nb-card { background-color: var(--background-basic-color-1); box-shadow: 0px 6px 20px 0px rgb(0 0 0 / 5%); border-radius: var(--border-radius); margin: 0; }
.gz-rtt nb-card-body, .gz-rtt nb-list { border-radius: 0 0 var(--border-radius) var(--border-radius); }
.gz-rtt nb-card-header { font-size: 14px; font-weight: 600; line-height: 16px; letter-spacing: -0.009em; color: var(--gauzy-text-color-2); }
.gz-rtt nb-card-header.gz-rtt-nb-card-header { display: flex; justify-content: space-between; align-items: center; }
.gz-rtt .gz-rtt-custom-card-body-inner, .gz-rtt .gz-rtt-custom-card-body-inner-list { background-color: var(--gauzy-card-2); }
.gz-rtt .gz-rtt-custom-card-body-inner-list { padding: 0 9px; overflow: unset; }
.gz-rtt .gz-rtt-custom-card-body-inner-list .gz-rtt-custom-card-button { display: flex; justify-content: flex-end; margin: 1rem 15px 0 15px; }
.gz-rtt .gz-rtt-font-weight-bold { font-weight: 600; color: var(--gauzy-text-color-2); }
.gz-rtt .gz-rtt-project-name { color: var(--gauzy-text-color-1); font-size: 14px; font-weight: 600; }
.gz-rtt .gz-rtt-hour-label { display: flex; justify-content: space-between; }
.gz-rtt .gz-rtt-button-container { display: flex; gap: 1rem; }
.gz-rtt .gz-rtt-text-center { text-align: center; }
.gz-rtt .gz-rtt-text-left { text-align: left; }
.gz-rtt .gz-rtt-text-right { text-align: right; }
.gz-rtt .gz-rtt-p-3 { padding: 1rem; }
.gz-rtt .gz-rtt-empty { text-align: center; }
.gz-rtt [nbbutton].appearance-outline.status-primary { background-color: unset; font-size: 12px; font-weight: 600; line-height: 15px; letter-spacing: 0em;
	border-color: var(--gauzy-background-transparent); color: var(--button-outline-primary-text-color); border-width: 2px; padding: 4px 10px; }
.gz-rtt .gz-rtt-link-text { cursor: pointer; text-decoration: none; color: #1e6bb8; font-size: small; }

/* Bootstrap-ish grid the Angular templates rely on (row / col-*) — only what the windows use. */
.gz-rtt .gz-rtt-row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
.gz-rtt .gz-rtt-row > * { padding-right: 15px; padding-left: 15px; box-sizing: border-box; }
.gz-rtt .gz-rtt-col { flex-basis: 0; flex-grow: 1; max-width: 100%; min-width: 0; }
.gz-rtt .gz-rtt-col-auto { flex: 0 0 auto; width: auto; max-width: 100%; }
.gz-rtt .gz-rtt-col-3 { flex: 0 0 25%; max-width: 25%; }
.gz-rtt .gz-rtt-col-4 { flex: 0 0 33.333333%; max-width: 33.333333%; }
.gz-rtt .gz-rtt-col-5 { flex: 0 0 41.666667%; max-width: 41.666667%; }
.gz-rtt .gz-rtt-align-items-center { align-items: center; }
.gz-rtt .gz-rtt-w-100 { width: 100%; }
.gz-rtt .gz-rtt-d-flex { display: flex; }
.gz-rtt .gz-rtt-py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.gz-rtt .gz-rtt-mb-1 { margin-bottom: 0.25rem; }
.gz-rtt .gz-rtt-mb-3 { margin-bottom: 1rem; }
.gz-rtt .gz-rtt-mt-2 { margin-top: 0.5rem; }
.gz-rtt .gz-rtt-mx-3 { margin-left: 1rem; margin-right: 1rem; }

/* ── Widgets grid (widget-layout.component.scss / widget.component.scss) ── */
.gz-rtt .gz-rtt-widgets { display: flex; flex-wrap: wrap; margin: 0 -0.5rem; }
/* Angular pins each widget to ~230–314px (a clamped polynomial of the viewport width) in a
   non-wrapping row; here the row wraps and each card grows between the same two bounds. */
.gz-rtt .gz-rtt-widget-drop { display: flex; flex: 1 1 246px; max-width: 330px; }
.gz-rtt .gz-rtt-widget { position: relative; color: var(--gauzy-text-color-2); min-width: 230px; max-width: 314px; flex: 1 1 auto;
	margin: 0rem 0.5rem 1rem; cursor: pointer; }
.gz-rtt .gz-rtt-widget > nb-card { height: 100%; }
.gz-rtt .gz-rtt-widget nb-card-body { padding: 8px 12px 8px 15px; }
[dir='rtl'] .gz-rtt .gz-rtt-widget nb-card-body { padding: 8px 15px 8px 12px; }
.gz-rtt .gz-rtt-widget.collapsed nb-card-body div.h1 { display: none; }
.gz-rtt .gz-rtt-widget.expanded nb-card-body div.h1 { display: block; }
.gz-rtt .gz-rtt-widget .gz-rtt-item-menu { font-size: 11px; position: absolute; right: 12px; top: 10.5px; z-index: 2; }
[dir='rtl'] .gz-rtt .gz-rtt-widget .gz-rtt-item-menu { right: auto; left: 12px; }
.gz-rtt .gz-rtt-widget nb-card-body > .gz-rtt-header-widget { font-size: 16px; font-weight: 400; line-height: 16px; letter-spacing: -0.009em;
	color: var(--gauzy-text-color-2); margin-bottom: 15px; padding-right: 20px; }
.gz-rtt .gz-rtt-counter-container { width: 71%; }

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
.gz-rtt .gz-rtt-window nb-card-header { padding-right: 2.5rem; }
.gz-rtt .gz-rtt-window nb-card.gz-rtt-member-list nb-card-body { padding: 8px; }
.gz-rtt .gz-rtt-window nb-card.gz-rtt-member-list .gz-rtt-list { max-height: 65vh; overflow-y: auto; }

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

/* ── Header controls (rendered into the Angular card header via portals) ── */
.gz-rtt-hdr { display: flex; align-items: center; }
.gz-rtt-hdr .gz-rtt-mr-2 { margin-right: 0.5rem; }
.gz-rtt-hdr .gz-rtt-manage-widget, .gz-rtt-hdr .gz-rtt-popover-button { font-size: 12px; font-weight: 400; display: inline-flex; align-items: center; gap: 0.5rem; }
.gz-rtt-hdr .gz-rtt-manage-widget[nbbutton], .gz-rtt-hdr .gz-rtt-popover-button[nbbutton] { color: var(--gauzy-text-color-1); background-color: var(--gauzy-card-1); }
.gz-rtt-hdr .gz-rtt-manage-widget nb-icon, .gz-rtt-hdr .gz-rtt-popover-button nb-icon { height: 11px; width: 11px; font-size: 11px; }
.gz-rtt-hdr .gz-rtt-toolbar { display: flex; align-items: center; }
.gz-rtt-hdr .gz-rtt-refresh[nbbutton] { display: inline-flex; align-items: center; gap: 0.35rem; }

/* nb-toggle look (toggle.component.scss + _toggle.component.theme.scss, size small = the app tokens) */
.gz-rtt-toggle { display: inline-flex; align-items: center; cursor: var(--toggle-cursor, pointer); margin: 0 1rem; user-select: none; }
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
.gz-rtt-toggle .gz-rtt-toggle-text { padding-left: 0.6875rem; font-family: var(--toggle-text-font-family); font-size: var(--toggle-text-font-size);
	font-weight: var(--toggle-text-font-weight); line-height: var(--toggle-text-line-height); color: var(--text-primary-color); }
[dir='rtl'] .gz-rtt-toggle .gz-rtt-toggle-text { padding-left: 0; padding-right: 0.6875rem; }

/* Popover bodies (timezone-filter.component.scss .popover-body / time-tracking .widget-popover) */
.gz-rtt-popover-body { display: flex; flex-direction: column; align-items: flex-start; padding: 10px; gap: 10px; min-width: 150px; }
.gz-rtt-widget-popover { display: flex; flex-direction: column; align-items: flex-start; padding: 14px; gap: 21px; min-width: 219px; }
.gz-rtt-popover-body .gz-rtt-category, .gz-rtt-widget-popover .gz-rtt-category { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; width: 100%; }
.gz-rtt-widget-popover .gz-rtt-category { gap: 14px; }
.gz-rtt-popover-body .gz-rtt-view, .gz-rtt-widget-popover .gz-rtt-view { font-size: 10px; font-weight: 600; line-height: 12px; letter-spacing: 0em;
	color: rgba(126, 126, 143, 0.5); align-items: center; display: flex; justify-content: space-between; gap: 1rem; width: 100%; }
.gz-rtt-popover-body .gz-rtt-title, .gz-rtt-widget-popover .gz-rtt-title { font-size: 12px; font-weight: 400; line-height: 12px; letter-spacing: 0em;
	color: var(--gauzy-text-color-2); display: flex; align-items: center; gap: 10px; cursor: pointer; width: 100%; background: none; border: 0; padding: 0; text-align: start; font-family: inherit; }
.gz-rtt-widget-popover .gz-rtt-title { line-height: 15px; }
.gz-rtt-popover-body .gz-rtt-title:hover, .gz-rtt-widget-popover .gz-rtt-title:hover { color: var(--gauzy-text-color-1); }
.gz-rtt-popover-body .gz-rtt-title i, .gz-rtt-widget-popover .gz-rtt-title i { width: 12px; }
.gz-rtt-popover-body .gz-rtt-line, .gz-rtt-widget-popover .gz-rtt-line { border-bottom: 0.5px solid rgba(126, 126, 143, 0.25); width: 100%; }
.gz-rtt-widget-popover .gz-rtt-undo { font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; }
.gz-rtt-widget-popover .gz-rtt-undo[nbbutton].appearance-filled.status-basic { color: var(--text-primary-color); }
.gz-rtt-widget-popover .gz-rtt-undo[disabled] { opacity: 0.5; }

/* ── Recent activities: avatar row + carousel (_swiper.scss) ── */
.gz-rtt .gz-rtt-swiper-button-container { display: flex; align-items: center; gap: 0.5rem; }
.gz-rtt .gz-rtt-swiper-button { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer;
	border-radius: 50%; background-color: var(--gauzy-sidebar-background-3); color: var(--gauzy-text-color-1); border: 0; padding: 0; font: inherit; }
.gz-rtt .gz-rtt-swiper-button:hover { background-color: var(--gauzy-sidebar-background-4); }
.gz-rtt .gz-rtt-swiper-button:disabled { opacity: 0.4; cursor: default; }
.gz-rtt .gz-rtt-carousel { overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; }
.gz-rtt .gz-rtt-carousel::-webkit-scrollbar { display: none; }
/* `--gz-rtt-slide-gap` is the single source for the cell gap: the track renders it, the slide
   width formula subtracts it, and the arrow buttons read it (ScreenshotCarousel.tsx). */
.gz-rtt .gz-rtt-carousel { --gz-rtt-slides: 3; --gz-rtt-slide-gap: 16px; }
.gz-rtt .gz-rtt-carousel-track { display: flex; gap: var(--gz-rtt-slide-gap); }
/* Slide width follows slidesPerView (a CSS var the component sets) but never drops below the
   screenshot card's own minimum: on a narrow canvas fewer slides show and the track scrolls,
   instead of three boxes shrinking under the cards and overlapping. */
.gz-rtt .gz-rtt-carousel-slide { flex: 0 0 max(calc((100% - (var(--gz-rtt-slides) - 1) * var(--gz-rtt-slide-gap)) / var(--gz-rtt-slides)), 189px); min-width: 0; scroll-snap-align: start; }
.gz-rtt .gz-rtt-avatar-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
.gz-rtt .gz-rtt-avatar-row > .gzrc-avatar { width: auto; min-width: 0; }
.gz-rtt .gz-rtt-view-all { display: flex; align-items: center; }

/* ── Screenshot item (screenshots-item.component.scss) ── */
.gz-rtt .gz-rtt-shot { border-radius: var(--border-radius); background: var(--gauzy-sidebar-background-4); box-shadow: var(--gauzy-shadow); min-width: 189px; max-width: 270px;
	display: flex; flex-direction: column; justify-content: center; border: unset; }
.gz-rtt .gz-rtt-shot:hover { box-shadow: var(--gauzy-shadow), 0px 36px 18px -24px rgba(0, 0, 0, 0.15); }
.gz-rtt .gz-rtt-shot.danger-bordered { border: 2px solid var(--color-danger-500) !important; box-shadow: none; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image { cursor: pointer; border-radius: var(--border-radius) var(--border-radius) 0 0; background: rgba(0, 0, 0, 0.1); min-height: 130px; position: relative; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image img { width: 100%; height: 130px; border-radius: var(--border-radius) var(--border-radius) 0 0; object-fit: cover; display: block; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image img.default-image { object-fit: contain; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-hover { padding: 5px; display: flex; flex-direction: column; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.7); opacity: 0; z-index: 9;
	align-items: center; justify-content: center; transition: opacity 0.5s; border-radius: var(--border-radius) var(--border-radius) 0 0; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-image:hover .gz-rtt-shot-hover { opacity: 1; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions { display: flex; align-items: center; width: 100%; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions .gz-rtt-ml-auto { margin-left: auto; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-actions .gz-rtt-ml-2 { margin-left: 0.5rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-view { height: 100%; width: 100%; flex-grow: 1; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-around; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-view [nbbutton] { font-size: 12px; font-weight: 400; line-height: 16px; letter-spacing: -0.009em; text-align: left; margin-right: 0.25rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-no-image { padding: 8px; background: rgba(0, 0, 0, 0.6); color: #fff; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border-radius: 5px; text-align: center; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info { font-size: 14px; font-weight: 400; line-height: 11px; letter-spacing: 0em; text-align: left; padding: 1rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-time-span { margin: 0.25rem 0 1.5rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-inline-time-span { white-space: nowrap; font-size: 0.75rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-caption { font-size: 11px; font-weight: 400; line-height: 11px; letter-spacing: 0em; color: var(--gauzy-text-color-2); margin-top: 0.5rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-slot-info .gz-rtt-activity-count { font-size: 14px; font-weight: 400; line-height: 11px; margin-top: 0.5rem; }
.gz-rtt .gz-rtt-shot .gz-rtt-shot-progress { background-color: var(--gauzy-card-2); }

/* ── Lists (manual time, tasks, projects, apps & urls, members) ── */
.gz-rtt .gz-rtt-list-item-body { width: 100%; }
.gz-rtt .gz-rtt-percent-cell { display: flex; align-items: center; }
.gz-rtt .gz-rtt-percent-cell .gz-rtt-custom-progress { margin: 0 1rem 0.25rem 1rem; width: 100%; height: 5px !important; }
.gz-rtt .gz-rtt-activity-item { display: flex; align-items: center; cursor: pointer; margin: 0 -15px; }
.gz-rtt .gz-rtt-activity-item > * { padding: 0 15px; box-sizing: border-box; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-title { flex: 0 0 41.666667%; max-width: 41.666667%; font-size: 14px; font-weight: 600; line-height: 17px; letter-spacing: 0em; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-progress { flex: 0 0 41.666667%; max-width: 41.666667%; display: flex; align-items: center; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-progress .gz-rtt-percentage-col { width: 90px; flex: 0 0 auto; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-progress .gz-rtt-tracking-progress { height: 5px !important; margin-bottom: 0.25rem; }
.gz-rtt .gz-rtt-activity-item .gz-rtt-activity-duration { flex: 1 1 0; text-align: right; }
.gz-rtt .gz-rtt-activity { text-align: center; }
.gz-rtt .gz-rtt-member-weekly-activity-graph { display: flex; align-items: flex-end; margin-left: 15px; min-height: 30px; }
.gz-rtt .gz-rtt-member-weekly-activity-graph .gz-rtt-bar-graph-entry { width: 7px; margin-right: 3px; background-color: #0095ff; min-height: 1px; }
`;
