import { Editor, Range } from '@tiptap/core';
import { TranslateService } from '@ngx-translate/core';
import { ISuggestionItem } from './suggestion-list.component';

/** Side-effectful hooks a few slash commands need (owned by the editor component). */
export interface ISlashCommandDeps {
	/** Opens the hidden file picker (image or any allowed type) and routes into the upload pipeline. */
	openFilePicker(kind: 'image' | 'file'): void;
	/** Small URL-prompt dialog; resolves null on cancel. */
	promptUrl(titleKey: string): Promise<string | null>;
}

export interface ISlashCommand {
	id: string;
	/** i18n group key under DOCS.EDITOR.SLASH.GROUP_*. */
	groupKey: string;
	icon: string;
	pack?: 'eva' | 'fa';
	/** i18n title key under DOCS.EDITOR.SLASH.*. */
	titleKey: string;
	keywords: string[];
	action(editor: Editor, range: Range, deps: ISlashCommandDeps): void;
}

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/**
 * Slash-menu command registry (spec 05 §6.4 — ids, groups, icons, keywords and
 * actions are normative). Every action starts with `deleteRange(range)`.
 */
export const SLASH_COMMANDS: ISlashCommand[] = [
	{
		id: 'text',
		groupKey: 'GROUP_BASIC',
		icon: 'text-outline',
		titleKey: 'TEXT',
		keywords: ['text', 'paragraph', 'plain'],
		action: (editor, range) => void chain(editor, range).setParagraph().run()
	},
	{
		id: 'heading1',
		groupKey: 'GROUP_BASIC',
		icon: 'fas fa-heading',
		pack: 'fa',
		titleKey: 'HEADING_1',
		keywords: ['h1', 'title', 'big'],
		action: (editor, range) => void chain(editor, range).setHeading({ level: 1 }).run()
	},
	{
		id: 'heading2',
		groupKey: 'GROUP_BASIC',
		icon: 'fas fa-heading',
		pack: 'fa',
		titleKey: 'HEADING_2',
		keywords: ['h2', 'subtitle'],
		action: (editor, range) => void chain(editor, range).setHeading({ level: 2 }).run()
	},
	{
		id: 'heading3',
		groupKey: 'GROUP_BASIC',
		icon: 'fas fa-heading',
		pack: 'fa',
		titleKey: 'HEADING_3',
		keywords: ['h3'],
		action: (editor, range) => void chain(editor, range).setHeading({ level: 3 }).run()
	},
	{
		id: 'bulletList',
		groupKey: 'GROUP_LISTS',
		icon: 'list-outline',
		titleKey: 'BULLET_LIST',
		keywords: ['ul', 'unordered', 'bullets'],
		action: (editor, range) => void chain(editor, range).toggleBulletList().run()
	},
	{
		id: 'orderedList',
		groupKey: 'GROUP_LISTS',
		icon: 'fas fa-list-ol',
		pack: 'fa',
		titleKey: 'ORDERED_LIST',
		keywords: ['ol', 'numbered'],
		action: (editor, range) => void chain(editor, range).toggleOrderedList().run()
	},
	{
		id: 'taskList',
		groupKey: 'GROUP_LISTS',
		icon: 'checkmark-square-2-outline',
		titleKey: 'TASK_LIST',
		keywords: ['todo', 'checkbox', 'tasks'],
		action: (editor, range) => void chain(editor, range).toggleTaskList().run()
	},
	{
		id: 'blockquote',
		groupKey: 'GROUP_BASIC',
		icon: 'fas fa-quote-right',
		pack: 'fa',
		titleKey: 'QUOTE',
		keywords: ['quote', 'citation'],
		action: (editor, range) => void chain(editor, range).setBlockquote().run()
	},
	{
		id: 'divider',
		groupKey: 'GROUP_BASIC',
		icon: 'minus-outline',
		titleKey: 'DIVIDER',
		keywords: ['hr', 'rule', 'separator'],
		action: (editor, range) => void chain(editor, range).setHorizontalRule().run()
	},
	{
		id: 'codeBlock',
		groupKey: 'GROUP_ADVANCED',
		icon: 'code-outline',
		titleKey: 'CODE_BLOCK',
		keywords: ['code', 'snippet', 'pre'],
		action: (editor, range) => void chain(editor, range).setCodeBlock().run()
	},
	{
		id: 'table',
		groupKey: 'GROUP_ADVANCED',
		icon: 'grid-outline',
		titleKey: 'TABLE',
		keywords: ['table', 'grid', 'rows'],
		action: (editor, range) =>
			void chain(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
	},
	{
		id: 'image',
		groupKey: 'GROUP_MEDIA',
		icon: 'image-outline',
		titleKey: 'IMAGE',
		keywords: ['image', 'picture', 'photo'],
		action: (editor, range, deps) => {
			chain(editor, range).run();
			deps.openFilePicker('image');
		}
	},
	{
		id: 'attachment',
		groupKey: 'GROUP_MEDIA',
		icon: 'attach-2-outline',
		titleKey: 'ATTACHMENT',
		keywords: ['file', 'upload', 'attach'],
		action: (editor, range, deps) => {
			chain(editor, range).run();
			deps.openFilePicker('file');
		}
	},
	{
		id: 'video',
		groupKey: 'GROUP_MEDIA',
		icon: 'video-outline',
		titleKey: 'VIDEO',
		keywords: ['video', 'embed'],
		action: (editor, range, deps) => {
			chain(editor, range).run();
			// `.then()` alone leaves the rejection channel open: `promptUrl` awaits
			// `firstValueFrom(ref.onClose)`, which rejects with `EmptyError` when the overlay
			// is disposed rather than closed, and the TipTap chain below can throw too.
			void deps
				.promptUrl('DOCS.EDITOR.SLASH.VIDEO')
				.then((url) => {
					if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
				})
				.catch(() => undefined);
		}
	},
	{
		id: 'embed',
		groupKey: 'GROUP_MEDIA',
		icon: 'link-2-outline',
		titleKey: 'EMBED',
		keywords: ['embed', 'bookmark', 'url'],
		action: (editor, range, deps) => {
			chain(editor, range).run();
			// Same rejection channel as the `video` item above.
			void deps
				.promptUrl('DOCS.EDITOR.SLASH.EMBED')
				.then((url) => {
					if (url) editor.chain().focus().insertEmbedCard({ url }).run();
				})
				.catch(() => undefined);
		}
	},
	{
		id: 'calloutInfo',
		groupKey: 'GROUP_ADVANCED',
		icon: 'info-outline',
		titleKey: 'CALLOUT_INFO',
		keywords: ['callout', 'info', 'note'],
		action: (editor, range) => void chain(editor, range).setCallout({ type: 'info' }).run()
	},
	{
		id: 'calloutWarning',
		groupKey: 'GROUP_ADVANCED',
		icon: 'alert-triangle-outline',
		titleKey: 'CALLOUT_WARNING',
		keywords: ['warning', 'caution'],
		action: (editor, range) => void chain(editor, range).setCallout({ type: 'warning' }).run()
	},
	{
		id: 'details',
		groupKey: 'GROUP_ADVANCED',
		icon: 'chevron-right-outline',
		titleKey: 'TOGGLE',
		keywords: ['toggle', 'collapse', 'details'],
		action: (editor, range) => void chain(editor, range).setDetails().run()
	},
	{
		id: 'emoji',
		groupKey: 'GROUP_BASIC',
		icon: 'smiling-face-outline',
		titleKey: 'EMOJI',
		keywords: ['emoji', 'emoticon'],
		action: (editor, range) => void chain(editor, range).insertContent(':').run()
	},
	{
		id: 'math',
		groupKey: 'GROUP_ADVANCED',
		icon: 'fas fa-square-root-variable',
		pack: 'fa',
		titleKey: 'MATH',
		keywords: ['math', 'latex', 'formula'],
		action: (editor, range) =>
			void chain(editor, range)
				.insertContent({ type: 'blockMath', attrs: { latex: '' } })
				.run()
	},
	{
		id: 'mentionEmployee',
		groupKey: 'GROUP_ADVANCED',
		icon: 'person-outline',
		titleKey: 'MENTION',
		keywords: ['mention', 'person', 'employee'],
		action: (editor, range) => void chain(editor, range).insertContent('@').run()
	},
	{
		id: 'linkDocument',
		groupKey: 'GROUP_ADVANCED',
		icon: 'file-text-outline',
		titleKey: 'LINK_DOCUMENT',
		keywords: ['doc', 'page', 'link', 'reference'],
		action: (editor, range) => void chain(editor, range).insertContent('+').run()
	}
];

/** Fuzzy filter on title + keywords, results grouped by group (spec 05 §6.4). */
export function filterSlashCommands(
	query: string,
	translate: TranslateService,
	deps: ISlashCommandDeps
): ISuggestionItem<{ command: ISlashCommand; deps: ISlashCommandDeps }>[] {
	const normalized = (query ?? '').trim().toLowerCase();
	return SLASH_COMMANDS.filter((command) => {
		if (!normalized) return true;
		const title = String(translate.instant(`DOCS.EDITOR.SLASH.${command.titleKey}`)).toLowerCase();
		return title.includes(normalized) || command.keywords.some((keyword) => keyword.includes(normalized));
	}).map((command) => ({
		id: command.id,
		label: translate.instant(`DOCS.EDITOR.SLASH.${command.titleKey}`),
		icon: command.icon,
		pack: command.pack ?? 'eva',
		group: translate.instant(`DOCS.EDITOR.SLASH.${command.groupKey}`),
		data: { command, deps }
	}));
}
