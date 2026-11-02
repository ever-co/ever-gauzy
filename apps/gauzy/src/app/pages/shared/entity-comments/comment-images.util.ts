import { ID } from '@gauzy/contracts';

/** An image attached to a comment: the uploaded image asset it refers to. */
export interface ICommentImage {
	name: string;
	assetId: ID;
}

/**
 * A line that is an attached image, as Markdown naming an uploaded image asset: `![name](asset:<id>)`. Only such a
 * reference counts — never a URL — so comment text cannot make the page load an address of the author's choosing,
 * and the image's address is looked up through the image asset API each time comments are read, within the
 * viewer's tenant (on S3-family storage it is a signed URL that expires, so it is never saved in the comment).
 */
const IMAGE_LINE = /^!\[([^\]\n]*)\]\(asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)$/i;

/**
 * Splits a comment's text into what was written and the images attached to it. The images travel in the
 * comment itself, one Markdown image per line after the text, so the comment API needs nothing new.
 */
export function parseCommentImages(comment: string): { text: string; images: ICommentImage[] } {
	let images: ICommentImage[] = [];
	const lines = (comment || '').split('\n').filter((line) => {
		const match = IMAGE_LINE.exec(line.trim());
		if (match) images.push({ name: match[1], assetId: match[2] });
		return !match;
	});
	return { text: lines.join('\n').trim(), images };
}

/** The text to post: what was written, then a line per attached image. */
export function withCommentImages(text: string, images: ICommentImage[]): string {
	const lines = images.map((image) => `![${image.name.replace(/[[\]\n]/g, '')}](asset:${image.assetId})`);
	return [text.trim(), lines.join('\n')].filter(Boolean).join('\n\n');
}
