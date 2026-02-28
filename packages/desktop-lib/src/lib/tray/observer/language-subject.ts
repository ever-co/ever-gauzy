export interface ILanguageObserver {
	onLanguageChanged(): void;
}

export class LanguageChangeSubject {
	private observers: ILanguageObserver[] = [];

	attach(observer: ILanguageObserver): void {
		if (this.observers.includes(observer)) return;
		this.observers.push(observer);
	}

	detach(observer: ILanguageObserver): void {
		const index = this.observers.indexOf(observer);
		if (index > -1) {
			this.observers.splice(index, 1);
		}
	}

	notify(): void {
		for (const observer of this.observers) {
			observer.onLanguageChanged();
		}
	}
}
