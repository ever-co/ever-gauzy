import { BackupStrategy } from '../../interfaces/backup-strategy.interface';
import { IPersistance } from '../../interfaces/persistance.interface';

export class PersistanceTakers {
	private _history: IPersistance[] = [];
	private _strategy: BackupStrategy;

	constructor() {}

	public addPersistance(persistance: IPersistance) {
		this._history.push(persistance);
		this._strategy.serializables = this._history;
	}
	public removePersistance(persistance: IPersistance) {
		let buffers: IPersistance[] = [];
		buffers = this._history.filter(
			(historyPersistance) => historyPersistance !== persistance
		);
		this._history = buffers;
		this._strategy.serializables = this._history;
	}
	public undo() {
		if (this._history.length > 1) this._history.pop();
	}

	public get lastPersistance() {
		if (this._history.length < 1) return;
		const size = this._history.length - 1;
		return this._history[size];
	}

	public get strategy(): BackupStrategy {
		return this._strategy;
	}
	public set strategy(value: BackupStrategy) {
		this._strategy = value;
	}
}
