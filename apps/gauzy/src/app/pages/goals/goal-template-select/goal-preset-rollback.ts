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
				const result = await record.remove();
				// A delete scoped to another organization than the record's matches no row (`{ affected: 0 }`): the
				// record is still there, so it is named as left behind
				if (deletedNothing(result)) {
					notRemoved.unshift(record.name);
				}
			} catch (error) {
				console.error(`Could not remove ${record.name} after the preset failed:`, error);
				notRemoved.unshift(record.name);
			}
		}
		return notRemoved;
	}
}

/** Whether a delete request answered that it removed no row (a TypeORM `DeleteResult` with `affected: 0`). */
function deletedNothing(result: unknown): boolean {
	return typeof result === 'object' && result !== null && (result as { affected?: unknown }).affected === 0;
}
