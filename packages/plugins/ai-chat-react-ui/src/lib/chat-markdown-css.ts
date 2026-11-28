import { chatTheme } from './chat-theme';

/**
 * The markdown root, written twice on purpose.
 *
 * Nebular's global typography emits `.nb-theme-<name> p { font-size: 0.875rem }` — and the same
 * for `li`, plus `color` on `p`, `li`, `a` and every heading. A single `.gz-ai-chat-markdown p`
 * ties that at (0,1,1), so which sheet won came down to load order, and any property left to
 * inheritance — the message font size — lost outright. Repeating the class lifts every rule
 * below to (0,2,1), above both Nebular and Bootstrap, without a single `!important`.
 */
const MD = '.gz-ai-chat-markdown.gz-ai-chat-markdown';

/**
 * Typography for markdown streamed by `streamdown`.
 *
 * Streamdown tags every node it emits with Tailwind class names; Gauzy ships no Tailwind, so
 * those classes resolve to nothing and every element would fall back to UA defaults — 2em bold
 * headings, 40px list indents, unstyled code cards. This sheet is that missing typography, sized
 * in `em` so it scales with the message text and toned with `color-mix` against `currentColor`
 * so it follows whichever Nebular theme is active.
 *
 * Exported as a string rather than a component because the hosts that render markdown (the chat
 * panel, the playground) each already inject one `<style>` block: they interpolate this into it,
 * so the rules exist once per host instead of once per message.
 */
export const chatMarkdownCss = `
		${MD} {
			max-width: 100%;
			min-width: 0;
			overflow-wrap: anywhere;
			font-size: ${chatTheme.fontSizeMessage};
			line-height: ${chatTheme.lineHeightMessage};
		}
		${MD} > :first-child { margin-top: 0; }
		${MD} > :last-child { margin-bottom: 0; }

		/* Nebular sets font-size, font-weight, line-height and colour absolutely on p and li,
		   so these follow the container explicitly rather than by inheritance. Body copy then
		   sits one step below the bubble tone, letting headings and bold runs read as brighter
		   without either ever reaching pure white. */
		${MD} p,
		${MD} li,
		${MD} td,
		${MD} th,
		${MD} blockquote {
			font-family: inherit;
			font-size: 1em;
			font-weight: inherit;
			line-height: inherit;
		}
		${MD} p,
		${MD} li,
		${MD} td { color: ${chatTheme.textBody}; }
		${MD} p { margin: 0 0 0.75em; }

		${MD} h1,
		${MD} h2,
		${MD} h3,
		${MD} h4,
		${MD} h5,
		${MD} h6 {
			margin: 1.15em 0 0.45em;
			font-family: inherit;
			font-weight: ${chatTheme.fontWeightSemibold};
			line-height: 1.35;
			letter-spacing: -0.005em;
			color: inherit;
		}
		${MD} h1 { font-size: 1.35em; }
		${MD} h2 { font-size: 1.22em; }
		${MD} h3 { font-size: 1.1em; }
		${MD} h4,
		${MD} h5,
		${MD} h6 { font-size: 1em; }
		${MD} h5,
		${MD} h6 { color: ${chatTheme.textSecondary}; }
		/* A heading straight after another block needs less air than one opening a section. */
		${MD} h1 + *,
		${MD} h2 + *,
		${MD} h3 + *,
		${MD} h4 + * { margin-top: 0; }

		${MD} ul,
		${MD} ol { margin: 0 0 0.75em; padding-left: 1.5em; }
		${MD} ul { list-style: disc; }
		${MD} ol { list-style: decimal; }
		${MD} li { margin: 0; padding-left: 0.15em; }
		${MD} li + li { margin-top: 0.3em; }
		${MD} li > ul,
		${MD} li > ol { margin: 0.3em 0 0; }
		${MD} li > ul { list-style: circle; }
		${MD} li::marker { color: ${chatTheme.textHint}; }
		${MD} ol > li::marker { font-variant-numeric: tabular-nums; }
		${MD} li > p { margin: 0; }
		${MD} li > p + p { margin-top: 0.4em; }
		${MD} li input[type='checkbox'] {
			margin: 0 0.45em 0 0;
			accent-color: ${chatTheme.accent};
			vertical-align: baseline;
		}
		/* A checkbox outside a task list only ever comes from a stray \`<input>\` tag in the model's
		   text (the renderer keeps it as a disabled checkbox) — a grey box that means nothing. */
		${MD} input[type='checkbox']:not(li input) { display: none; }

		/* 600, not the UA's 700: bold runs should read as emphasis, not shouting. */
		${MD} strong,
		${MD} b { font-weight: ${chatTheme.fontWeightSemibold}; }
		${MD} em { font-style: italic; }

		${MD} a {
			color: ${chatTheme.link};
			font-weight: ${chatTheme.fontWeightMedium};
			text-decoration: none;
			border-bottom: 1px solid color-mix(in srgb, currentColor 32%, transparent);
			transition: border-color ${chatTheme.transitionSpeed} ease;
		}
		${MD} a:hover { border-bottom-color: currentColor; }

		${MD} code {
			font-family: ${chatTheme.fontFamilyMono};
			font-size: 0.92em;
			font-weight: 400;
			padding: 0.12em 0.36em;
			border-radius: 4px;
			border: 1px solid ${chatTheme.borderSoft};
			background: ${chatTheme.inlineCodeBg};
			color: ${chatTheme.codeText};
			overflow-wrap: anywhere;
		}

		/* Fenced blocks. Streamdown nests header / actions / body inside a
		   code-block wrapper, so the card lives on the wrapper and every inner
		   box stays transparent. */
		${MD} [data-streamdown='code-block'] {
			position: relative;
			margin: 0 0 0.85em;
			border: 1px solid ${chatTheme.codeBorder};
			border-radius: 10px;
			background: ${chatTheme.codeBg};
			overflow: hidden;
		}
		${MD} [data-streamdown='code-block-header'] {
			display: flex;
			align-items: center;
			height: 30px;
			/* Room on the right for the copy / download buttons that sit on this row. */
			padding: 0 72px 0 0.85em;
			border-bottom: 1px solid ${chatTheme.borderSoft};
			background: color-mix(in srgb, currentColor 3%, transparent);
			font-family: ${chatTheme.fontFamilyMono};
			font-size: 0.85em;
			text-transform: lowercase;
			color: ${chatTheme.textHint};
		}
		${MD} [data-streamdown='code-block-body'] {
			padding: 0.85em 0.9em;
			overflow-x: auto;
			background: transparent;
			border: none;
			color: ${chatTheme.codeText};
		}
		${MD} pre {
			max-width: 100%;
			margin: 0;
			padding: 0;
			background: transparent;
			border: none;
			/* Bootstrap ships pre { color: #212529 } globally — unreadable on a dark theme. */
			color: inherit;
			overflow-x: auto;
			white-space: pre;
			font-family: ${chatTheme.fontFamilyMono};
			font-size: 0.95em;
			line-height: 1.65;
			tab-size: 2;
		}
		${MD} pre code {
			padding: 0;
			border: none;
			background: none;
			font-size: 1em;
			color: inherit;
		}
		/* Copy / download: Streamdown pins them top-right with Tailwind classes this app does not
		   ship, so without this they fell out as a row of their own between the header and the
		   code. Pinned onto the header row instead, the way a code card carries them. */
		${MD} [data-streamdown='code-block'] > div:has(> [data-streamdown='code-block-actions']) {
			position: absolute;
			top: 0;
			right: 0;
			height: 30px;
			display: flex;
			align-items: center;
			padding: 0 6px;
			margin: 0;
		}
		${MD} [data-streamdown='code-block-actions'] {
			display: inline-flex;
			align-items: center;
			gap: 2px;
			padding: 0;
			border: none;
			background: transparent;
			color: ${chatTheme.textHint};
		}
		${MD} [data-streamdown='code-block-actions'] button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 22px;
			height: 22px;
			padding: 0;
			border: none;
			border-radius: 5px;
			background: transparent;
			color: inherit;
			cursor: pointer;
			transition: background-color ${chatTheme.transitionSpeed} ease, color ${chatTheme.transitionSpeed} ease;
		}
		${MD} [data-streamdown='code-block-actions'] button:hover {
			background: ${chatTheme.surfaceDeep};
			color: ${chatTheme.textPrimary};
		}
		${MD} [data-streamdown='code-block-actions'] svg { width: 12px; height: 12px; }

		${MD} blockquote {
			margin: 0 0 0.95em;
			padding: 0.1em 0 0.1em 0.85em;
			border-left: 2px solid ${chatTheme.quoteBar};
			color: ${chatTheme.textSecondary};
			font-style: normal;
		}
		${MD} blockquote p { color: inherit; }
		${MD} blockquote > :last-child { margin-bottom: 0; }

		/* The scroll lives on the WRAPPER, never on the table: border-collapse only
		   applies to table/inline-table boxes, so a \`display: block\` table silently
		   drops it and every cell draws its own border — 2px doubled gridlines
		   between neighbours. The table keeps its table box and stays inside a
		   scroller instead. A table may exceed \`max-width\` when its min-content
		   width does, which is exactly when the wrapper starts scrolling; anything
		   narrower wraps to fit as before. */
		/* Streamdown wraps a table as [controls row] + [scroller > table], styled with Tailwind
		   classes this app does not ship. The scroller becomes the framed card; the controls sit
		   right-aligned above it as quiet icon buttons. */
		${MD} [data-streamdown='table-wrapper'] {
			display: flex;
			flex-direction: column;
			gap: 4px;
			max-width: 100%;
			min-width: 0;
			margin: 0 0 0.85em;
		}
		${MD} [data-streamdown='table-wrapper'] > div:first-child:not(:last-child) {
			display: flex;
			justify-content: flex-end;
			align-items: center;
			gap: 2px;
		}
		${MD} [data-streamdown='table-wrapper'] > div:first-child:not(:last-child) button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 22px;
			height: 22px;
			padding: 0;
			border: none;
			border-radius: 5px;
			background: transparent;
			color: ${chatTheme.textHint};
			cursor: pointer;
			transition: background-color ${chatTheme.transitionSpeed} ease, color ${chatTheme.transitionSpeed} ease;
		}
		${MD} [data-streamdown='table-wrapper'] > div:first-child:not(:last-child) button:hover {
			background: ${chatTheme.surfaceDeep};
			color: ${chatTheme.textPrimary};
		}
		${MD} [data-streamdown='table-wrapper'] svg { width: 13px; height: 13px; }
		${MD} [data-streamdown='table-wrapper'] > div:last-child {
			max-width: 100%;
			min-width: 0;
			overflow-x: auto;
			border: 1px solid ${chatTheme.border};
			border-radius: 8px;
		}
		${MD} table {
			display: table;
			width: 100%;
			border-collapse: collapse;
			margin: 0;
			font-size: 0.95em;
		}
		${MD} th,
		${MD} td {
			padding: 0.5em 0.75em;
			border: none;
			border-bottom: 1px solid ${chatTheme.borderSoft};
			text-align: left;
			vertical-align: top;
		}
		${MD} tbody tr:last-child td { border-bottom: none; }
		${MD} th {
			font-weight: ${chatTheme.fontWeightSemibold};
			white-space: nowrap;
			background: ${chatTheme.surface};
			border-bottom-color: ${chatTheme.border};
			color: inherit;
		}

		${MD} hr {
			height: 0;
			border: none;
			border-top: 1px solid ${chatTheme.border};
			margin: 1.2em 0;
		}
		${MD} img,
		${MD} video { max-width: 100%; height: auto; border-radius: 8px; }

		/* Thin, theme-tinted scrollbars — the default chrome is heavy enough to
		   dominate a 300px panel. Scoped, never applied app-wide. */
		.gz-ai-chat-scroll,
		${MD} pre,
		${MD} table,
		${MD} [data-streamdown='table-wrapper'] > div:last-child,
		${MD} [data-streamdown='code-block-body'] {
			scrollbar-width: thin;
			scrollbar-color: ${chatTheme.scrollbarThumb} ${chatTheme.scrollbarTrack};
		}
		.gz-ai-chat-scroll::-webkit-scrollbar,
		${MD} pre::-webkit-scrollbar,
		${MD} table::-webkit-scrollbar,
		${MD} [data-streamdown='table-wrapper'] > div:last-child::-webkit-scrollbar,
		${MD} [data-streamdown='code-block-body']::-webkit-scrollbar { width: 6px; height: 6px; }
		.gz-ai-chat-scroll::-webkit-scrollbar-track,
		${MD} pre::-webkit-scrollbar-track,
		${MD} table::-webkit-scrollbar-track,
		${MD} [data-streamdown='table-wrapper'] > div:last-child::-webkit-scrollbar-track,
		${MD} [data-streamdown='code-block-body']::-webkit-scrollbar-track { background: ${chatTheme.scrollbarTrack}; }
		.gz-ai-chat-scroll::-webkit-scrollbar-thumb,
		${MD} pre::-webkit-scrollbar-thumb,
		${MD} table::-webkit-scrollbar-thumb,
		${MD} [data-streamdown='table-wrapper'] > div:last-child::-webkit-scrollbar-thumb,
		${MD} [data-streamdown='code-block-body']::-webkit-scrollbar-thumb {
			background: ${chatTheme.scrollbarThumb};
			border-radius: 999px;
		}
`;
