/**
 * Sets `<meta name="referrer" content="no-referrer">` while a page that holds an account deletion token is
 * open, and puts the previous policy back when it closes. The token lives in the URL fragment, which
 * browsers never send in `Referer`, but the page should not leak even its path to a third party.
 *
 * @returns A function that restores the previous policy.
 */
export function useNoReferrer(document: Document): () => void {
	let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
	const previous = meta?.getAttribute('content') ?? null;
	const created = !meta;
	if (!meta) {
		meta = document.createElement('meta');
		meta.setAttribute('name', 'referrer');
		document.head.appendChild(meta);
	}
	meta.setAttribute('content', 'no-referrer');
	return () => {
		if (created) {
			meta?.remove();
		} else if (previous !== null) {
			meta?.setAttribute('content', previous);
		}
	};
}
