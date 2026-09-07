import { TextAlign } from '@tiptap/extension-text-align';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextStyleKit } from '@tiptap/extension-text-style';
import type { PresetDefinition, RichTextEditorPresetOptions } from './preset.types';
import { baseLinkConfiguration, configureStarterKit, AbsoluteUrlImage } from './preset-utils';

/**
 * `email` preset (05-editor-spec.md §3.3): email-safe inline set for the
 * candidate-interview email composer. No code, no tables, no highlight, no task
 * lists. Headings 1–3, alignment serialized as inline `style="text-align: …"`
 * (email-safe), links restricted to absolute `http(s)`/`mailto` URLs, images
 * restricted to absolute URLs. Content produced here is never persisted to a DB
 * column, so it carries no legacy-coverage obligation.
 */
export function createEmailPreset(options: RichTextEditorPresetOptions = {}): PresetDefinition {
	return {
		preset: 'email',
		extensions: [
			configureStarterKit({
				heading: { levels: [1, 2, 3] },
				code: false,
				codeBlock: false,
				link: {
					...baseLinkConfiguration,
					// Email clients only resolve absolute URLs.
					isAllowedUri: (url: string) => /^(https?:\/\/|mailto:)/i.test(url)
				},
				placeholder: { placeholder: options.placeholder ?? '' },
				characterCount: { limit: options.characterLimit ?? null }
			}),
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			AbsoluteUrlImage,
			TextStyleKit,
			Subscript,
			Superscript
		],
		toolbar: [
			'history',
			'blockFormat',
			'marks',
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
			// Strike stays registered for parsing but is not offered in the email toolbar.
			marks: ['bold', 'italic', 'underline'],
			alignments: ['left', 'center', 'right']
		}
	};
}
