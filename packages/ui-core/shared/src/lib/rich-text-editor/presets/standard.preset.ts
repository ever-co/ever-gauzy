import { TextAlign } from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextStyleKit } from '@tiptap/extension-text-style';
import type { PresetDefinition, RichTextEditorPresetOptions } from './preset.types';
import { baseLinkConfiguration, configureStarterKit, LegacyImage } from './preset-utils';

/**
 * `standard` preset (05-editor-spec.md §3.3): the full legacy round-trip schema.
 * Headings parse at levels 1–6 (toolbar offers 1–3), text alignment, resizable
 * tables, task lists, images (render-only), highlight, sub/superscript, and
 * TextStyleKit (TextStyle + Color + FontFamily) for legacy font-span compatibility.
 *
 * Binding rule from 06-ckeditor-removal.md §3.1: any field that has ever stored
 * CKEditor HTML MUST use this preset so nothing is dropped on load.
 */
export function createStandardPreset(options: RichTextEditorPresetOptions = {}): PresetDefinition {
	return {
		preset: 'standard',
		extensions: [
			configureStarterKit({
				heading: { levels: [1, 2, 3, 4, 5, 6] },
				link: baseLinkConfiguration,
				placeholder: { placeholder: options.placeholder ?? '' },
				characterCount: { limit: options.characterLimit ?? null }
			}),
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			TableKit.configure({ table: { resizable: true } }),
			TaskList,
			TaskItem.configure({ nested: true }),
			LegacyImage,
			Highlight.configure({ multicolor: true }),
			Subscript,
			Superscript,
			TextStyleKit
		],
		toolbar: [
			'history',
			'blockFormat',
			'marks',
			'code',
			'codeBlock',
			'script',
			'color',
			'font',
			'align',
			'lists',
			'blocks',
			'insert',
			'clearFormat'
		],
		toolbarOptions: {
			marks: ['bold', 'italic', 'underline', 'strike'],
			alignments: ['left', 'center', 'right', 'justify']
		}
	};
}
