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

export type TkbMouseActivity = {
	kbPressCount: number;
	kbSequence: number[];
	mouseMovementsCount: number;
	mouseLeftClickCount: number;
	mouseRightClickCount: number;
	mouseEvents: TMouseEvents[]

}
