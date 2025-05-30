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

export interface KbMouseActivityTO {
	id?: number;
	timeStart: Date;
	timeEnd: Date | null;
	kbPressCount: number;
	kbSequence: number[] | any;
	mouseMovementsCount: number;
	mouseLeftClickCount: number;
	mouseRightClickCount: number;
	mouseEvents: TMouseEvents[];
	organizationId: string;
	tenantId: string;
	remoteId: string;
	screenshots: string[] | any;
}

export const TABLE_NAME_KB_MOUSE_ACTIVITY: string = 'kb_mouse_activity';
