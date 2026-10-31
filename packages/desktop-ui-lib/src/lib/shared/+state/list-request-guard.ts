/**
 * Tells whether the answer to a request for a selector's list still belongs to the list shown.
 *
 * A selector empties its list (`SelectorService.resetPage()`) when what it lists changes: another organization, a new
 * search, or the client, project or team its entries are filtered by. An answer to a request made before that, coming
 * in late, would otherwise put the old entries back in the list, where the user could pick them (an entry of the
 * organization left, a team of the project before).
 */
export class ListRequestGuard {
	/** Counts the times the list was emptied. */
	private _version = 0;

	/** The list was emptied: the answers to the requests made until now are dropped. */
	public invalidate(): void {
		this._version++;
	}

	/**
	 * Starts a request.
	 *
	 * @param context what the request was made for (the organization), read again once the server has answered.
	 * @returns a check, for once the server has answered, of whether the answer may still go in the list: the list was
	 * not emptied since, and the context is the same.
	 */
	public start(context: () => unknown): () => boolean {
		const version = this._version;
		const requestedFor = context();
		return () => version === this._version && context() === requestedFor;
	}
}
