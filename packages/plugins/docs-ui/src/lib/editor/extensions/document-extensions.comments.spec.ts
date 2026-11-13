import { Injector } from '@angular/core';
import type { AnyExtension } from '@tiptap/core';
import { TranslateService } from '@ngx-translate/core';
import type { IBlockCommentsOptions } from './block-comments.plugin';
import { createDocumentEditorExtensions, IDocumentEditorExtensionDeps } from './document-extensions';

// `lowlight` ships ESM only and only feeds CodeBlockLowlight's highlighting plugin, which this contract never reaches.
jest.mock('lowlight', () => ({
	createLowlight: () => ({
		register: () => undefined,
		registered: () => false,
		listLanguages: () => [],
		highlight: () => ({ type: 'root', children: [] }),
		highlightAuto: () => ({ type: 'root', children: [] })
	})
}));

/**
 * The editor's comment layer as the real factory configures it: every callback of `BlockComments` reaches the
 * editor's dependency of the same job (the component specs build a lighter editor with the same wiring).
 */
describe('createDocumentEditorExtensions: the comment layer', () => {
	function blockCommentsOptions(deps: Partial<IDocumentEditorExtensionDeps>): IBlockCommentsOptions {
		const extensions = createDocumentEditorExtensions({
			// The mention suggestions resolve their services eagerly; building the extensions never calls them.
			injector: { get: () => ({}) } as unknown as Injector,
			translate: { instant: (key: string) => `t:${key}` } as unknown as TranslateService,
			suggestionHost: {},
			uploadService: {},
			slashCommandDeps: {},
			onTocUpdate: () => undefined,
			...deps
		} as unknown as IDocumentEditorExtensionDeps);
		const blockComments = (extensions as AnyExtension[]).find((extension) => extension.name === 'gzBlockComments');
		if (!blockComments) throw new Error('the comment layer is missing');
		return blockComments.options as IBlockCommentsOptions;
	}

	it('routes the marker and highlight clicks, Mod-Alt-M, the live positions and the found places to the editor', () => {
		const resolver = () => null;
		const places = new Map();
		const deps = {
			onOpenCommentThread: jest.fn(),
			onCommentSelection: jest.fn(),
			commentLiveResolver: jest.fn(() => resolver),
			onCommentRangesResolved: jest.fn()
		};
		const options = blockCommentsOptions(deps);

		options.onOpenThread('b1');
		options.onOpenThread('b1', 't1');
		expect(deps.onOpenCommentThread.mock.calls).toEqual([
			['b1', undefined],
			['b1', 't1']
		]);
		options.onComment?.();
		expect(deps.onCommentSelection).toHaveBeenCalledTimes(1);
		expect(options.liveResolver?.()).toBe(resolver);
		options.onRangesResolved?.(places);
		expect(deps.onCommentRangesResolved).toHaveBeenCalledWith(places);
		expect(options.markerLabel).toBe('t:DOCS.EDITOR.COMMENT.MARKER_ARIA');
	});

	it('leaves Mod-Alt-M to the browser and reads no live positions when the editor gives none', () => {
		const options = blockCommentsOptions({});
		expect(options.onComment).toBeUndefined();
		expect(options.liveResolver?.()).toBeNull();
		expect(() => options.onOpenThread('b1', 't1')).not.toThrow();
		expect(() => options.onRangesResolved?.(new Map())).not.toThrow();
	});
});
