import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'success' | 'warning' | 'danger';

export interface ICalloutAttributes {
	type: CalloutType;
	/** Optional emoji override for the default status icon. */
	emoji: string | null;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		callout: {
			/** Wraps the current block in a callout of the given type. */
			setCallout: (attributes?: Partial<ICalloutAttributes>) => ReturnType;
			/** Lifts the content back out of the callout. */
			unsetCallout: () => ReturnType;
		};
	}
}

/**
 * `callout` custom node (spec 05 §6.2): block container with a status type and
 * an optional emoji override. Plain `renderHTML`/`parseHTML` keep it renderable
 * by `@tiptap/static-renderer` without Angular; the interactive node view is
 * attached in `document-extensions.ts`.
 */
export const Callout = Node.create({
	name: 'callout',
	group: 'block',
	content: 'paragraph+',
	defining: true,

	addAttributes() {
		return {
			type: {
				default: 'info' as CalloutType,
				parseHTML: (element) => (element.dataset.calloutType as CalloutType) || 'info',
				renderHTML: (attributes) => ({ 'data-callout-type': attributes['type'] })
			},
			emoji: {
				// `?? null` keeps the absent-attribute value the `null` default expects
				// (`dataset` answers `undefined` where `getAttribute` answered `null`).
				default: null,
				parseHTML: (element) => element.dataset.calloutEmoji ?? null,
				renderHTML: (attributes) =>
					attributes['emoji'] ? { 'data-callout-emoji': attributes['emoji'] } : {}
			}
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="callout"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'gz-callout' }), 0];
	},

	addCommands() {
		return {
			setCallout:
				(attributes = {}) =>
				({ commands }) =>
					commands.wrapIn(this.name, { type: 'info', emoji: null, ...attributes }),
			unsetCallout:
				() =>
				({ commands }) =>
					commands.lift(this.name)
		};
	}
});
