/** An image attached to a comment. */
export interface ICommentImage {
	name: string;
	url: string;
}

/**
 * A line that is an attached image, as Markdown: `![name](https://…)`. Only absolute http(s) URLs count, so a
 * comment cannot make the page load anything else.
 */
const IMAGE_LINE = /^!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)$/;

/**
 * Splits a comment's text into what was written and the images attached to it. The images travel in the
 * comment itself, one Markdown image per line after the text, so the comment API needs nothing new and any
 * other client still shows a readable link.
 */
export function parseCommentImages(comment: string): { text: string; images: ICommentImage[] } {
	const images: ICommentImage[] = [];
	const lines = (comment || '').split('\n').filter((line) => {
		const match = IMAGE_LINE.exec(line.trim());
		if (match) images.push({ name: match[1], url: match[2] });
		return !match;
	});
	return { text: lines.join('\n').trim(), images };
}

/** The text to post: what was written, then a line per attached image. */
export function withCommentImages(text: string, images: ICommentImage[]): string {
	// A space or `)` would end the URL early: both are encoded, which the browser reads back the same.
	const urlOf = (url: string) => url.replace(/\s/g, '%20').replace(/\)/g, '%29');
	const lines = images.map((image) => `![${image.name.replace(/[[\]\n]/g, '')}](${urlOf(image.url)})`);
	return [text.trim(), lines.join('\n')].filter(Boolean).join('\n\n');
}
