import { Injector } from '@angular/core';
import { AnyExtension, Editor, Extensions, Range, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Focus, Placeholder } from '@tiptap/extensions';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Mention from '@tiptap/extension-mention';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import Emoji, { emojis } from '@tiptap/extension-emoji';
import Mathematics from '@tiptap/extension-mathematics';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import DragHandle from '@tiptap/extension-drag-handle';
import UniqueID from '@tiptap/extension-unique-id';
import { TableOfContents, getHierarchicalIndexes } from '@tiptap/extension-table-of-contents';
import FileHandler from '@tiptap/extension-file-handler';
import InvisibleCharacters from '@tiptap/extension-invisible-characters';
import { Markdown } from '@tiptap/markdown';
import { PluginKey } from '@tiptap/pm/state';
import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { TranslateService } from '@ngx-translate/core';
import { AngularNodeViewRenderer } from '../node-view/angular-node-view-renderer';
import { CalloutNodeViewComponent } from '../node-views/callout-node-view.component';
import { EmbedCardNodeViewComponent } from '../node-views/embed-card-node-view.component';
import { FileAttachmentNodeViewComponent } from '../node-views/file-attachment-node-view.component';
import { ImageNodeViewComponent } from '../node-views/image-node-view.component';
import { EditorUploadService } from '../services/editor-upload.service';
import { SuggestionHostService } from '../suggestion/suggestion-host.service';
import { ISuggestionItem } from '../suggestion/suggestion-list.component';
import { ISlashCommandDeps } from '../suggestion/slash-menu.items';
import { createSlashCommandExtension } from '../suggestion/slash-command.extension';
import { createEmployeeMention } from '../suggestion/employee-mention.suggestion';
import { createDocumentMention } from '../suggestion/document-mention.suggestion';
import { Base64Guard } from './base64-guard.plugin';
import { BlockComments } from './block-comments.plugin';
import { Callout } from './callout.node';
import { EmbedCard } from './embed-card.node';
import { FileAttachment } from './file-attachment.node';

/**
 * Trimmed lowlight language set (spec 05 §12 — registration dominates code-block
 * cost; adding a language is a code change with a bundle-budget review).
 *
 * The 16 grammars below are exactly the §12 list — never `lowlight/common` or the
 * full bundle. `xml` covers HTML; `plaintext` is the code block's default language.
 */
export const DOCS_LOWLIGHT_LANGUAGES = {
	typescript,
	javascript,
	xml,
	css,
	scss,
	json,
	bash,
	sql,
	python,
	java,
	csharp,
	php,
	yaml,
	dockerfile,
	markdown,
	plaintext
};

export function createDocsLowlight() {
	const lowlight = createLowlight();
	lowlight.register(DOCS_LOWLIGHT_LANGUAGES);
	return lowlight;
}

export interface IDocumentEditorExtensionDeps {
	injector: Injector;
	translate: TranslateService;
	suggestionHost: SuggestionHostService;
	uploadService: EditorUploadService;
	slashCommandDeps: ISlashCommandDeps;
	/** ToC anchors sink (feeds the page's ToC side panel). */
	onTocUpdate(anchors: unknown[]): void;
	/** A block's comment gutter marker was activated — opens that thread in the rail (spec 05 §8). */
	onOpenCommentThread?(blockId: string): void;
	/** Realtime co-editing flag — MUST disable StarterKit undoRedo when true (spec 05 §11). */
	collab?: boolean;
}

/** UniqueID coverage (spec 05 §5) — anchors for comments + deep links. */
const UNIQUE_ID_TYPES = [
	'heading',
	'paragraph',
	'blockquote',
	'codeBlock',
	'table',
	'callout',
	'fileAttachment',
	'embedCard',
	'taskList',
	'bulletList',
	'orderedList',
	'details',
	'image',
	'youtube'
];

/** Image extended with `documentId`/`width`/`align` + transient `uploadId` (spec 05 §5/§6.6). */
const DocsImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			documentId: {
				default: null,
				// `?? null` on the data-* reads below: `dataset` answers `undefined`
				// where `getAttribute` answered `null`, and both defaults are `null`.
				parseHTML: (element: HTMLElement) => element.dataset.documentId ?? null,
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes['documentId'] ? { 'data-document-id': attributes['documentId'] } : {}
			},
			width: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('width'),
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes['width'] ? { width: attributes['width'] } : {}
			},
			align: {
				default: null,
				parseHTML: (element: HTMLElement) => element.dataset.align ?? null,
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes['align'] ? { 'data-align': attributes['align'] } : {}
			},
			// Transient upload marker — stripped from persisted JSON (spec 05 §6.6).
			uploadId: {
				default: null,
				parseHTML: () => null,
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes['uploadId'] ? { 'data-uploading': 'true' } : {}
			}
		};
	}
});

const employeeMentionStatic = Mention.extend({ name: 'employeeMention' }).configure({
	HTMLAttributes: { class: 'gz-employee-mention', 'data-type': 'employee-mention' },
	renderText: ({ node }) => `@${node.attrs['label'] ?? node.attrs['id']}`,
	renderHTML: ({ options, node }) => [
		'span',
		mergeAttributes(options.HTMLAttributes, { 'data-id': node.attrs['id'] }),
		`@${node.attrs['label'] ?? node.attrs['id']}`
	],
	suggestion: { char: '@', pluginKey: new PluginKey('gzEmployeeMentionStatic') }
});

const documentMentionStatic = Mention.extend({ name: 'documentMention' }).configure({
	HTMLAttributes: { class: 'gz-document-mention', 'data-type': 'document-mention' },
	renderText: ({ node }) => `+${node.attrs['label'] ?? node.attrs['id']}`,
	renderHTML: ({ options, node }) => [
		'a',
		mergeAttributes(options.HTMLAttributes, {
			'data-id': node.attrs['id'],
			href: `/pages/documents?id=${node.attrs['id']}`
		}),
		`${node.attrs['label'] ?? node.attrs['id']}`
	],
	suggestion: { char: '+', pluginKey: new PluginKey('gzDocumentMentionStatic') }
});

/** Shared schema core used by both the live editor and the static renderer. */
function createSchemaExtensions(options: { collab: boolean }): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			codeBlock: false, // replaced by CodeBlockLowlight
			link: {
				openOnClick: false,
				autolink: true,
				linkOnPaste: true,
				HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
			},
			// UndoRedo × Collaboration exclusivity (spec 05 §11).
			undoRedo: options.collab ? false : undefined,
			// Registered separately, configured per-document below.
			...({ placeholder: false, characterCount: false, focus: false } as Record<string, unknown>)
		} as never),
		CodeBlockLowlight.configure({ lowlight: createDocsLowlight(), defaultLanguage: 'plaintext' }),
		TableKit.configure({ table: { resizable: true, allowTableNodeSelection: true } } as never),
		TaskList,
		TaskItem.configure({ nested: true }),
		DocsImage,
		Youtube.configure({ nocookie: true, controls: true }),
		Details.configure({ persist: true, HTMLAttributes: { class: 'gz-details' } }),
		DetailsSummary,
		DetailsContent,
		Emoji.configure({ enableEmoticons: true }),
		Mathematics,
		Highlight.configure({ multicolor: true }),
		Subscript,
		Superscript,
		TextAlign.configure({ types: ['heading', 'paragraph'] }),
		TextStyleKit,
		Typography,
		UniqueID.configure({ types: UNIQUE_ID_TYPES, attributeName: 'blockId' }),
		Callout,
		FileAttachment,
		EmbedCard
	] as Extensions;
}

/**
 * Schema-only extension set for `@tiptap/static-renderer` (read-only render,
 * version previews, print) — no menus, no suggestions, no node views, no DOM
 * plugins in the read path (spec 05 §9.1).
 */
export function createStaticExtensions(): Extensions {
	return [...createSchemaExtensions({ collab: false }), employeeMentionStatic, documentMentionStatic];
}

/**
 * Full Tier-2 extension set for `gz-document-editor` (spec 05 §5 is normative
 * for every configuration here).
 */
export function createDocumentEditorExtensions(deps: IDocumentEditorExtensionDeps): Extensions {
	const collab = deps.collab ?? false;
	const translate = deps.translate;

	const extensions: Extensions = [
		...createSchemaExtensions({ collab }),
		Placeholder.configure({
			includeChildren: true,
			placeholder: ({ node }) => {
				if (node.type.name === 'heading') {
					return translate.instant('DOCS.EDITOR.PLACEHOLDER.HEADING', { level: node.attrs['level'] });
				}
				return translate.instant('DOCS.EDITOR.PLACEHOLDER.PARAGRAPH');
			}
		}),
		CharacterCount,
		Focus.configure({ className: 'has-focus', mode: 'deepest' }),
		DragHandle.configure({
			render: () => {
				const handle = document.createElement('div');
				handle.className = 'gz-drag-handle';
				handle.setAttribute('aria-hidden', 'true');
				handle.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';
				return handle;
			}
		}),
		TableOfContents.configure({
			getIndex: getHierarchicalIndexes,
			onUpdate: (content: unknown[]) => deps.onTocUpdate(content)
		} as never),
		FileHandler.configure({
			onDrop: (editor, files, pos) => deps.uploadService.handleFiles(editor, files, pos),
			onPaste: (editor, files) => deps.uploadService.handleFiles(editor, files)
		}),
		InvisibleCharacters.configure({ visible: false }),
		Markdown.configure({ html: false } as never),
		Base64Guard,
		// Gutter markers for blocks with an open comment thread (spec 05 §8). The anchor set
		// is pushed in by the page's Comments rail via `setCommentedBlocks()`.
		BlockComments.configure({
			onOpenThread: (blockId: string) => deps.onOpenCommentThread?.(blockId),
			markerLabel: translate.instant('DOCS.EDITOR.COMMENT.MARKER_ARIA')
		}),
		createSlashCommandExtension({
			host: deps.suggestionHost,
			translate,
			commandDeps: deps.slashCommandDeps
		}),
		createEmployeeMention(deps.injector, deps.suggestionHost),
		createDocumentMention(deps.injector, deps.suggestionHost)
	];

	// Attach the Angular node views to the three custom nodes (spec 05 §6.2/§6.3)
	// and route the emoji `:` suggestion through the shared popup host (§6.4).
	const withNodeViews = extensions.map((extension: AnyExtension) => {
		switch (extension.name) {
			case 'emoji':
				return (extension as typeof Emoji).configure({
					suggestion: {
						char: ':',
						pluginKey: new PluginKey('gzEmojiSuggestion'),
						items: ({ query }: { query: string }) => filterEmojiItems(query),
						command: ({ editor, range, props }: { editor: Editor; range: Range; props: unknown }) => {
							const item = props as ISuggestionItem<{ name: string }>;
							editor.chain().focus().deleteRange(range).setEmoji(item.data.name).run();
						},
						render: () => ({
							onStart: (props: never) => deps.suggestionHost.open(props, 'DOCS.EDITOR.SLASH.EMOJI'),
							onUpdate: (props: never) => deps.suggestionHost.update(props, 'DOCS.EDITOR.SLASH.EMOJI'),
							onKeyDown: ({ event }: { event: KeyboardEvent }) => deps.suggestionHost.onKeyDown(event),
							onExit: () => deps.suggestionHost.close()
						})
					}
				} as never);
			case 'callout':
				return (extension as typeof Callout).extend({
					addNodeView: () => AngularNodeViewRenderer(CalloutNodeViewComponent, { injector: deps.injector })
				});
			case 'fileAttachment':
				return (extension as typeof FileAttachment).extend({
					addNodeView: () =>
						AngularNodeViewRenderer(FileAttachmentNodeViewComponent, { injector: deps.injector })
				});
			// 🛑 Without this the persisted `/raw` src is handed straight to the browser as
			// `<img src>`, which sends no Authorization header and 401s — every embedded
			// image rendered broken. The node view fetches the bytes authenticated instead
			// (spec 05 §6.6 step 5).
			case 'image':
				return (extension as typeof DocsImage).extend({
					addNodeView: () => AngularNodeViewRenderer(ImageNodeViewComponent, { injector: deps.injector })
				});
			case 'embedCard':
				return (extension as typeof EmbedCard).extend({
					addNodeView: () => AngularNodeViewRenderer(EmbedCardNodeViewComponent, { injector: deps.injector })
				});
			default:
				return extension;
		}
	});

	return withNodeViews as Extensions;
}

/** Emoji suggestion items for the shared popup (`:` trigger — spec 05 §5). */
export function filterEmojiItems(query: string): ISuggestionItem<{ name: string }>[] {
	const normalized = (query ?? '').trim().toLowerCase();
	return (emojis as { name: string; emoji?: string; shortcodes: string[]; tags: string[] }[])
		.filter(
			(candidate) =>
				!normalized ||
				candidate.name.toLowerCase().includes(normalized) ||
				candidate.shortcodes.some((code) => code.toLowerCase().includes(normalized)) ||
				candidate.tags.some((tag) => tag.toLowerCase().includes(normalized))
		)
		.slice(0, 12)
		.map((candidate) => ({
			id: candidate.name,
			label: `:${candidate.name}:`,
			glyph: candidate.emoji,
			data: { name: candidate.name }
		}));
}
