import {
	DEFAULT_TIMER_SOUND_TONES,
	ITimerSoundAudioContext,
	scheduleTones,
	TIMER_SOUND_VOLUME
} from './timer-sound-tones';

/** A recording stand-in for the Web Audio API (jsdom has none). */
function fakeAudioContext(currentTime = 10) {
	const oscillators: any[] = [];
	const gains: any[] = [];
	const destination = { name: 'speakers' };
	const param = () => ({ setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() });
	const context = {
		currentTime,
		destination,
		createOscillator: jest.fn(() => {
			const oscillator = {
				type: 'square',
				frequency: param(),
				connect: jest.fn(),
				disconnect: jest.fn(),
				start: jest.fn(),
				stop: jest.fn(),
				onended: null as null | (() => void)
			};
			oscillators.push(oscillator);
			return oscillator;
		}),
		createGain: jest.fn(() => {
			const gain = { gain: param(), connect: jest.fn(), disconnect: jest.fn() };
			gains.push(gain);
			return gain;
		})
	};
	return { context: context as unknown as ITimerSoundAudioContext, oscillators, gains, destination };
}

describe('timer sound tones', () => {
	it('tells start and stop apart: going up, then going down', () => {
		const pitches = (cue: 'start' | 'stop') => DEFAULT_TIMER_SOUND_TONES[cue].map((tone) => tone.frequency);
		const [startFirst, startLast] = pitches('start');
		const [stopFirst, stopLast] = pitches('stop');

		expect(startLast).toBeGreaterThan(startFirst);
		expect(stopLast).toBeLessThan(stopFirst);
		expect(pitches('start')).not.toEqual(pitches('stop'));
	});

	it('keeps each cue short', () => {
		for (const tones of Object.values(DEFAULT_TIMER_SOUND_TONES)) {
			const end = Math.max(...tones.map((tone) => tone.offset + tone.duration));
			expect(end).toBeLessThanOrEqual(0.5);
		}
	});

	it('plays each note as a faded sine wave on the speakers, from now', () => {
		const { context, oscillators, gains, destination } = fakeAudioContext(10);

		const end = scheduleTones(context, DEFAULT_TIMER_SOUND_TONES.start);

		expect(oscillators).toHaveLength(2);
		const [first, second] = oscillators;
		expect(first.type).toBe('sine');
		expect(first.frequency.setValueAtTime).toHaveBeenCalledWith(659.25, 10);
		expect(second.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10.12);
		expect(first.start).toHaveBeenCalledWith(10);
		expect(first.stop).toHaveBeenCalledWith(10.12);
		expect(second.start).toHaveBeenCalledWith(10.12);
		expect(second.stop).toHaveBeenCalledWith(expect.closeTo(10.28, 5));
		expect(end).toBeCloseTo(10.28, 5);

		oscillators.forEach((oscillator, index) => expect(oscillator.connect).toHaveBeenCalledWith(gains[index]));
		gains.forEach((gain) => expect(gain.connect).toHaveBeenCalledWith(destination));
		// Fades in to the volume, then out: no click
		expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 10);
		expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(1, TIMER_SOUND_VOLUME, 10.01);
		expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(2, 0.0001, 10.12);
	});

	it('lets go of the nodes once a note ended', () => {
		const { context, oscillators, gains } = fakeAudioContext();

		scheduleTones(context, DEFAULT_TIMER_SOUND_TONES.stop);
		oscillators[0].onended();

		expect(oscillators[0].disconnect).toHaveBeenCalled();
		expect(gains[0].disconnect).toHaveBeenCalled();
		expect(oscillators[1].disconnect).not.toHaveBeenCalled();
	});

	it('keeps the volume and the notes within what the Web Audio API takes', () => {
		const { context, oscillators, gains } = fakeAudioContext(0);

		scheduleTones(context, [{ frequency: 440, offset: -1, duration: 0 }], 5);

		expect(oscillators[0].start).toHaveBeenCalledWith(0);
		expect(oscillators[0].stop).toHaveBeenCalledWith(0.02);
		expect(gains[0].gain.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(1, 1, 0.01);
	});

	it('plays nothing for no notes', () => {
		const { context, oscillators } = fakeAudioContext(3);

		expect(scheduleTones(context, [])).toBe(3);
		expect(oscillators).toHaveLength(0);
	});
});
