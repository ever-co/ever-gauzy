/**
 * The records one "Create from Preset" attempt has created so far, and how to remove each of them again.
 *
 * A preset is saved in several requests — the KPIs of its KPI key results, the objective, then the objective's key
 * results — and the API has no endpoint that saves them together in one transaction. When a later request fails,
 * the attempt removes what the earlier ones created, so a failed attempt leaves no orphaned KPIs (or an objective
 * without its key results) behind, and trying again does not pile up a second set.
 */
export class GoalPresetRollback {
	private readonly created: { name: string; remove: () => Promise<unknown> }[] = [];

	/**
	 * Records a record this attempt created.
	 *
	 * @param name What the user knows the record by, named back to them if it cannot be removed.
	 * @param remove Removes the record (the delete request of its service).
	 */
	add(name: string, remove: () => Promise<unknown>): void {
		this.created.push({ name, remove });
	}

	/**
	 * Removes every record this attempt created, newest first: the objective (which takes its key results with it)
	 * before the KPIs those key results link to. A removal that fails does not stop the others.
	 *
	 * @returns The names of the records that could not be removed, in the order they were created; empty when
	 *   nothing is left behind. The list is cleared either way, so a second call removes nothing.
	 */
	async undo(): Promise<string[]> {
		const notRemoved: string[] = [];
		for (const record of this.created.splice(0).reverse()) {
			try {
				await record.remove();
			} catch (error) {
				console.error(`Could not remove ${record.name} after the preset failed:`, error);
				notRemoved.unshift(record.name);
			}
		}
		return notRemoved;
	}
}
