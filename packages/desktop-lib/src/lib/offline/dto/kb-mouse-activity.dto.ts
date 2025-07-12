export type TMouseEvents = {
	moveTo: {
		from: {
			x: number;
			y: number;
		};
		to: {
			x: number;
			y: number;
		};
	};
};

export type TActiveWindows = {
	name: string;
	duration: number;
	dateStart: Date;
	dateEnd: Date;
	meta: {
		url?: string;
		title: string;
		platform?: string;
	}[]
}

export interface KbMouseActivityTO {
	id?: number;
	timeStart: Date;
	timeEnd: Date | null;
	kbPressCount: number;
	kbSequence: number[] | string;
	mouseMovementsCount: number;
	mouseLeftClickCount: number;
	mouseRightClickCount: number;
	mouseEvents: TMouseEvents[] | string;
	organizationId: string;
	tenantId: string;
	remoteId: string;
	screenshots: string[] | string;
	afkDuration: number;
	activeWindows: TActiveWindows[] | string;

}

export const TABLE_NAME_KB_MOUSE_ACTIVITY: string = 'kb_mouse_activity';
