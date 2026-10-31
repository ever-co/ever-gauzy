import { ISoundFileAudio, SoundFilePlayer } from './sound-file-player';

describe('SoundFilePlayer', () => {
	let created: { file: string; audio: { play: jest.Mock; pause: jest.Mock } }[];
	let player: SoundFilePlayer;

	beforeEach(() => {
		created = [];
		player = new SoundFilePlayer((file) => {
			const audio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn() };
			created.push({ file, audio });
			return audio as unknown as ISoundFileAudio;
		});
	});

	it('plays the file it is given', async () => {
		await player.play('/app/assets/sound.wav');

		expect(created).toHaveLength(1);
		expect(created[0].file).toBe('/app/assets/sound.wav');
		expect(created[0].audio.play).toHaveBeenCalledTimes(1);
		expect(player.file).toBe('/app/assets/sound.wav');
	});

	it('keeps the audio of the same file', async () => {
		await player.play('/app/assets/sound.wav');
		await player.play('/app/assets/sound.wav');
		await player.play();

		expect(created).toHaveLength(1);
		expect(created[0].audio.play).toHaveBeenCalledTimes(3);
	});

	it('plays a new file from the next sound on (a screenshot sound chosen in the settings)', async () => {
		await player.play('/app/assets/sound.wav');
		await player.play('/user-data/sounds/screenshot-sound-1.mp3');

		expect(created.map(({ file }) => file)).toEqual([
			'/app/assets/sound.wav',
			'/user-data/sounds/screenshot-sound-1.mp3'
		]);
		expect(created[0].audio.pause).toHaveBeenCalled();
		expect(created[1].audio.play).toHaveBeenCalledTimes(1);
	});

	it('does nothing before it has a file', async () => {
		await expect(player.play()).resolves.toBeUndefined();
		await expect(player.play('')).resolves.toBeUndefined();

		expect(created).toHaveLength(0);
		expect(player.file).toBeNull();
	});

	it('reports a sound that cannot play through the promise, never by throwing', async () => {
		player = new SoundFilePlayer(() => {
			throw new Error('no audio');
		});
		await expect(player.play('/a.wav')).rejects.toThrow('no audio');

		const refused = new Error('NotSupportedError');
		player = new SoundFilePlayer(() => ({ play: jest.fn().mockRejectedValue(refused), pause: jest.fn() }) as any);
		await expect(player.play('/a.wav')).rejects.toBe(refused);
	});
});
