/**
 * Represents mouse movement events with start and end coordinates.
 */
export type TMouseEvents = {
	moveTo: {
		from: {
			x: number;
			y: number;
		},
		to: {
			x: number;
			y: number;
		}
	}
}

/**
 * Aggregates keyboard and mouse activity data for tracking user interactions.
 */
export type TKbMouseActivity = {
	kbPressCount: number;
	kbSequence: number[];
	mouseMovementsCount: number;
	mouseLeftClickCount: number;
	mouseRightClickCount: number;
	mouseEvents: TMouseEvents[]
}
