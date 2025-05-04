
import { app } from 'electron';

type TMouseEvents = {
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

type TkbMouseActivity = {
	kbPressCount: number;
	kbSequence: number[];
	mouseMovementsCount: number;
	mouseLeftClickCount: number;
	mouseRightClickCount: number;
	mouseEvents: TMouseEvents[]

}
class KeyboardMouseActivityStores {
	currentActivityData: TkbMouseActivity;
	userPath: string;
	constructor() {
		this.userPath = app.getPath('userData');
		this.resetCurrentAcitivity();
	}

	writeData() {
		console.log('current last data activities', JSON.stringify(this.currentActivityData, null, 2));
	}

	resetCurrentAcitivity() {
		this.currentActivityData = {
			kbSequence: [],
			kbPressCount: 0,
			mouseRightClickCount: 0,
			mouseLeftClickCount: 0,
			mouseMovementsCount: 0,
			mouseEvents: []
		};
	}

	readLastData() {

	}

	updateCurrentKeyPressCount() {
		this.currentActivityData.kbPressCount = (this.currentActivityData?.kbPressCount || 0) + 1;
	}

	updateMouseMovementsCount() {
		this.currentActivityData.mouseMovementsCount = (this.currentActivityData?.mouseMovementsCount || 0) + 1;
	}

	updateMouseLeftClick() {
		this.currentActivityData.mouseLeftClickCount = (this.currentActivityData?.mouseLeftClickCount || 0) + 1;
	}

	updateMouseRightClick() {
		this.currentActivityData.mouseRightClickCount = (this.currentActivityData?.mouseRightClickCount || 0) + 1;
	}

	updateKbSequence(keyCode: number) {
		(this.currentActivityData?.kbSequence || []).push(keyCode);
	}

	updateMouseEvents(mouseEventMovement: TMouseEvents) {
		(this.currentActivityData?.mouseEvents || []).push(mouseEventMovement);
	}

	flushCurrentData() {

	}
}

export default KeyboardMouseActivityStores;
