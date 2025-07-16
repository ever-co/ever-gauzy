export interface ITrackingSleepStrategy {
	resume(): void;

	pause(): void;

	dispose(): void;
}
