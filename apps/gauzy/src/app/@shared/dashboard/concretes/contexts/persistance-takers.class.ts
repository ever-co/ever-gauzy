import { BackupStrategy } from '../../interfaces/backup-strategy.interface';
import { IPersistance } from '../../interfaces/persistance.interface';

export class PersistanceTakers {
	private _history: IPersistance[] = [];
	private _strategy: BackupStrategy;

	constructor() {}

	public addPersistance(persistance: IPersistance) {
		this._history.push(persistance);
		this._strategy.serializables = this.history;
	}
	public removePersistance(persistance: IPersistance) {
		let buffers: IPersistance[] = [];
		buffers = this.history.filter(
			(historyPersistance) => historyPersistance !== persistance
		);
		this.history = buffers;
		this._strategy.serializables = this.history;
	}
	public undo() {
		this.history.pop();
	}
	public get history(): IPersistance[] {
		return this._history;
	}
	public set history(value: IPersistance[]) {
		this._history = value;
	}

	public get strategy(): BackupStrategy {
		return this._strategy;
	}
	public set strategy(value: BackupStrategy) {
		this._strategy = value;
	}
}
