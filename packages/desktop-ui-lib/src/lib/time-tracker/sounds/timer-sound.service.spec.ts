import { TestBed } from '@angular/core/testing';
import { DesktopSoundSettingsChannel } from '@gauzy/contracts';
import { firstValueFrom, from, Subject, toArray } from 'rxjs';
import { ElectronService } from '../../electron/services';
import { IgnitionState, ITimerIgnition, TimerStartMode } from '../+state/time-tracker.store';
import {
	isTimerSoundEnabled,
	TIMER_SOUND_AUDIO_CONTEXT,
	TIMER_SOUND_TONES,
	TimerSoundService
} from './timer-sound.service';
import { DEFAULT_TIMER_SOUND_TONES } from './timer-sound-tones';

/** A Web Audio stand-in that counts the notes played (jsdom has no audio). */
function fakeAudioContext(state: AudioContextState = 'running') {
	const notes: number[] = [];
	const param = () => ({ setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() });
	return {
		notes,
		state,
		currentTime: 0,
		destination: {},
		resume: jest.fn(async function (this: { state: AudioContextState }) {
			this.state = 'running';
		}),
		createOscillator: jest.fn(() => {
			const frequency = { ...param(), setValueAtTime: jest.fn((value: number) => notes.push(value)) };
			return { frequency, connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn() };
		}),
		createGain: jest.fn(() => ({ gain: param(), connect: jest.fn(), disconnect: jest.fn() }))
	};
}

/** The answers of the sound settings handler (DesktopSoundSettingsChannel.GET). */
const enabled = { timerStartStopSound: true };
const disabled = { timerStartStopSound: false };

describe('TimerSoundService', () => {
	let electron: { invoke: jest.Mock };
	let context: ReturnType<typeof fakeAudioContext>;
	let createContext: jest.Mock;
	let service: TimerSoundService;

	function setUp(providers: any[] = []) {
		TestBed.configureTestingModule({
			providers: [
				{ provide: ElectronService, useValue: electron },
				{ provide: TIMER_SOUND_AUDIO_CONTEXT, useValue: createContext },
				...providers
			]
		});
		service = TestBed.inject(TimerSoundService);
	}

	beforeEach(() => {
		electron = { invoke: jest.fn().mockResolvedValue(enabled) };
		context = fakeAudioContext();
		createContext = jest.fn(() => context);
	});

	describe('isTimerSoundEnabled', () => {
		it('is on only when the setting is switched on', () => {
			expect(isTimerSoundEnabled(enabled)).toBe(true);
			expect(isTimerSoundEnabled(disabled)).toBe(false);
			expect(isTimerSoundEnabled({})).toBe(false);
			expect(isTimerSoundEnabled({ timerStartStopSound: 'true' } as any)).toBe(false);
			expect(isTimerSoundEnabled(null)).toBe(false);
			expect(isTimerSoundEnabled(undefined)).toBe(false);
		});
	});

	describe('play', () => {
		beforeEach(() => setUp());

		it('plays nothing while the setting is off (the default)', async () => {
			electron.invoke.mockResolvedValue(disabled);

			await expect(service.play('start')).resolves.toBe(false);

			// Only the sound settings are read, not the whole configuration
			expect(electron.invoke).toHaveBeenCalledWith(DesktopSoundSettingsChannel.GET);
			expect(electron.invoke).not.toHaveBeenCalledWith('app_setting');
			expect(createContext).not.toHaveBeenCalled();
		});

		it('plays distinct notes for a start and a stop', async () => {
			await expect(service.play('start')).resolves.toBe(true);
			const start = [...context.notes];
			context.notes.length = 0;
			await expect(service.play('stop')).resolves.toBe(true);

			expect(start).toEqual(DEFAULT_TIMER_SOUND_TONES.start.map((tone) => tone.frequency));
			expect(context.notes).toEqual(DEFAULT_TIMER_SOUND_TONES.stop.map((tone) => tone.frequency));
			expect(start).not.toEqual(context.notes);
		});

		it('reads the setting on each cue, so switching it applies at once', async () => {
			electron.invoke.mockResolvedValueOnce(enabled).mockResolvedValueOnce(disabled);

			await expect(service.play('start')).resolves.toBe(true);
			await expect(service.play('stop')).resolves.toBe(false);
		});

		it('opens one audio context and keeps it', async () => {
			await service.play('start');
			await service.play('stop');
			await service.play('start');

			expect(createContext).toHaveBeenCalledTimes(1);
		});

		it('wakes up an audio context the page suspended', async () => {
			context.state = 'suspended';

			await expect(service.play('start')).resolves.toBe(true);

			expect(context.resume).toHaveBeenCalled();
		});

		it('plays nothing without the Web Audio API', async () => {
			createContext.mockReturnValue(null);

			await expect(service.play('start')).resolves.toBe(false);
		});

		it('never throws: not without the main process, not when the audio fails', async () => {
			const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

			electron.invoke.mockRejectedValueOnce(new Error('Electron API is not available'));
			await expect(service.play('start')).resolves.toBe(false);

			context.createOscillator.mockImplementationOnce(() => {
				throw new Error('audio device lost');
			});
			await expect(service.play('stop')).resolves.toBe(false);

			expect(warn).toHaveBeenCalledTimes(2);
			warn.mockRestore();
		});
	});

	describe('tones', () => {
		it('takes the notes an app provides', async () => {
			setUp([
				{
					provide: TIMER_SOUND_TONES,
					useValue: { start: [{ frequency: 1000, offset: 0, duration: 0.1 }], stop: [] }
				}
			]);

			await expect(service.play('start')).resolves.toBe(true);
			await expect(service.play('stop')).resolves.toBe(false);

			expect(context.notes).toEqual([1000]);
		});
	});

	describe('watch', () => {
		beforeEach(() => setUp());

		it('plays the cues of the timer of this computer', async () => {
			const play = jest.spyOn(service, 'play');
			const ignitions: ITimerIgnition[] = [
				{ state: IgnitionState.STOPPED, mode: TimerStartMode.STOP },
				{ state: IgnitionState.STARTING, mode: TimerStartMode.STOP },
				{ state: IgnitionState.STARTED, mode: TimerStartMode.MANUAL },
				{ state: IgnitionState.STOPPING, mode: TimerStartMode.MANUAL },
				{ state: IgnitionState.STOPPED, mode: TimerStartMode.STOP }
			];

			const cues = await firstValueFrom(service.watch(from(ignitions)).pipe(toArray()));

			expect(cues).toEqual(['start', 'stop']);
			expect(play.mock.calls).toEqual([['start'], ['stop']]);
		});

		it('stays silent for the timer of another device', () => {
			const play = jest.spyOn(service, 'play');
			const ignition$ = new Subject<ITimerIgnition>();
			const subscription = service.watch(ignition$).subscribe();

			ignition$.next({ state: IgnitionState.STOPPED, mode: TimerStartMode.STOP });
			ignition$.next({ state: IgnitionState.STARTED, mode: TimerStartMode.REMOTE });
			ignition$.next({ state: IgnitionState.STOPPED, mode: TimerStartMode.STOP });
			subscription.unsubscribe();

			expect(play).not.toHaveBeenCalled();
		});
	});

	describe('quietly', () => {
		const stopped: ITimerIgnition = { state: IgnitionState.STOPPED, mode: TimerStartMode.STOP };
		const stopping: ITimerIgnition = { state: IgnitionState.STOPPING, mode: TimerStartMode.MANUAL };
		const starting: ITimerIgnition = { state: IgnitionState.STARTING, mode: TimerStartMode.MANUAL };
		const startedHere: ITimerIgnition = { state: IgnitionState.STARTED, mode: TimerStartMode.MANUAL };
		let ignition$: Subject<ITimerIgnition>;
		let play: jest.SpyInstance;

		beforeEach(() => {
			setUp();
			play = jest.spyOn(service, 'play');
			ignition$ = new Subject<ITimerIgnition>();
			service.watch(ignition$).subscribe();
			ignition$.next(stopped);
			ignition$.next(startedHere);
			play.mockClear();
		});

		afterEach(() => ignition$.complete());

		it('keeps the midnight rollover silent (stop, then start again for the new day)', async () => {
			const result = await service.quietly(async () => {
				ignition$.next(stopping);
				ignition$.next(stopped);
				ignition$.next(starting);
				ignition$.next(startedHere);
				return 'restarted';
			});

			expect(result).toBe('restarted');
			expect(play).not.toHaveBeenCalled();

			// The user stopping afterwards is cued as usual
			ignition$.next(stopped);
			expect(play.mock.calls).toEqual([['stop']]);
		});

		it('cues a stop when the rollover failed and left the timer stopped, and passes the error on', async () => {
			await expect(
				service.quietly(async () => {
					ignition$.next(stopping);
					ignition$.next(stopped);
					throw new Error('could not start again');
				})
			).rejects.toThrow('could not start again');

			expect(play.mock.calls).toEqual([['stop']]);
		});

		it('stays quiet until the last of nested quiet stretches ends', async () => {
			await service.quietly(async () => {
				await service.quietly(async () => ignition$.next(stopped));
				expect(play).not.toHaveBeenCalled();
				ignition$.next(startedHere);
			});

			expect(play).not.toHaveBeenCalled();
		});
	});
});
