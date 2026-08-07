import type { Extensions } from '@tiptap/core';

/**
 * The three tier-1 presets of `ga-rich-text-editor` (05-editor-spec.md §3.3).
 *
 * - `minimal`  — marks, lists, link, blockquote, code. Reserved for new, history-free
 *                fields; MUST NOT be wired to a field with pre-existing CKEditor HTML.
 * - `standard` — full legacy round-trip coverage (headings 1–6 parse, alignment, tables,
 *                task lists, images, colors/fonts, highlight, sub/superscript). Mandatory
 *                for every field that has ever stored CKEditor HTML (06-ckeditor-removal.md §3.1).
 * - `email`    — email-safe inline set for the candidate-interview email composer.
 */
export type RichTextEditorPreset = 'minimal' | 'standard' | 'email';

/**
 * Toolbar clusters rendered by `ga-rich-text-toolbar`. A preset lists the clusters it
 * shows; within a cluster, individual buttons are additionally gated on schema
 * membership (e.g. the task-list button only renders when the `taskList` node exists).
 */
export type ToolbarGroup =
	| 'history'
	| 'blockFormat'
	| 'marks'
	| 'code'
	| 'codeBlock'
	| 'script'
	| 'color'
	| 'font'
	| 'align'
	| 'lists'
	| 'blocks'
	| 'insert'
	| 'clearFormat';

export type ToolbarMark = 'bold' | 'italic' | 'underline' | 'strike';

export type ToolbarAlignment = 'left' | 'center' | 'right' | 'justify';

/**
 * Per-preset toolbar fine-tuning that cannot be derived from the schema alone
 * (e.g. `email` registers Strike for parsing but does not offer it in the toolbar).
 */
export interface PresetToolbarOptions {
	marks: ToolbarMark[];
	alignments: ToolbarAlignment[];
}

/**
 * Options forwarded from the component inputs into the preset factory at
 * editor-instantiation time.
 */
export interface RichTextEditorPresetOptions {
	/** Already-translated placeholder text (wired to the Placeholder extension). */
	placeholder?: string;
	/** CharacterCount hard limit (`null` = unlimited). */
	characterLimit?: number | null;
}

/**
 * What a preset factory produces: the extension set registered in the schema plus
 * the toolbar layout driven by it.
 */
export interface PresetDefinition {
	preset: RichTextEditorPreset;
	extensions: Extensions;
	toolbar: ToolbarGroup[];
	toolbarOptions: PresetToolbarOptions;
}
