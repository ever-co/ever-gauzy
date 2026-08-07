import { Node, mergeAttributes } from '@tiptap/core';

export interface IEmbedCardAttributes {
	url: string;
	title: string | null;
	description: string | null;
	imageUrl: string | null;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		embedCard: {
			/** Inserts an embed/bookmark card for the given URL. */
			insertEmbedCard: (attributes: Partial<IEmbedCardAttributes> & { url: string }) => ReturnType;
		};
	}
}

/**
 * `embedCard` custom node (spec 05 §6.2): atomic, draggable bookmark card.
 * v1 renders a generic globe + domain (no external favicon fetch); the attrs
 * are forward-compatible with server-side metadata enrichment (spec 05 §16).
 */
export const EmbedCard = Node.create({
	name: 'embedCard',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			url: {
				default: '',
				parseHTML: (element) => element.getAttribute('href') ?? element.getAttribute('data-url') ?? '',
				renderHTML: () => ({})
			},
			title: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-title'),
				renderHTML: (attributes) => (attributes['title'] ? { 'data-title': attributes['title'] } : {})
			},
			description: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-description'),
				renderHTML: (attributes) =>
					attributes['description'] ? { 'data-description': attributes['description'] } : {}
			},
			imageUrl: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-image-url'),
				renderHTML: (attributes) =>
					attributes['imageUrl'] ? { 'data-image-url': attributes['imageUrl'] } : {}
			}
		};
	},

	parseHTML() {
		return [{ tag: 'a[data-type="embed-card"]' }];
	},

	renderHTML({ node, HTMLAttributes }) {
		const url = (node.attrs['url'] as string) || '';
		return [
			'a',
			mergeAttributes(HTMLAttributes, {
				'data-type': 'embed-card',
				class: 'gz-embed-card',
				href: url,
				target: '_blank',
				rel: 'noopener noreferrer nofollow'
			}),
			(node.attrs['title'] as string) || url
		];
	},

	addCommands() {
		return {
			insertEmbedCard:
				(attributes) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: { title: null, description: null, imageUrl: null, ...attributes }
					})
		};
	}
});
