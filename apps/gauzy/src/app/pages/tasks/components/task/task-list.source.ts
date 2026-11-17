import { ServerDataSource } from '@gauzy/ui-core/core';

/**
 * The task list's server source. The list's `finalize` reports a failed read once, so a read that the table or the
 * pager starts through the source (a refresh, another page) leaves no unhandled rejection behind and draws nothing.
 */
export class TaskListSource extends ServerDataSource {
	protected override emitOnChanged(action: string): void {
		this.getElements().then(
			(elements) =>
				this.onChangedSource.next({
					action,
					elements,
					paging: this.getPaging(),
					filter: this.getFilter(),
					sort: this.getSort()
				}),
			() => undefined
		);
	}
}
