import { ISequence } from '.';
import { Timer } from '../offline';

export interface ITimerService<T> {
	save(timer: Timer): Promise<void>;
	findAll(): Promise<T[]>;
	findById(timer: Partial<Timer>): Promise<T>;
	remove(timer: Partial<Timer>): Promise<void>;
	update(timer: Partial<Timer>): Promise<void>;
	findLastOne(): Promise<T>;
	findLastCapture(): Promise<T>;
	findToSynced(): Promise<ISequence[]>;
}
