import { ISoundFileAudio, SoundFilePlayer, soundFileUrl } from './sound-file-player';

describe('soundFileUrl', () => {
	it.each([
		[
			'C:\\Program Files\\Gauzy\\resources\\data\\sound\\snapshot-sound.wav',
			'file:///C:/Program%20Files/Gauzy/resources/data/sound/snapshot-sound.wav'
		],
		[
			'C:\\Users\\J#\\AppData\\Roaming\\gauzy\\sounds\\screenshot-sound-1.mp3',
			'file:///C:/Users/J%23/AppData/Roaming/gauzy/sounds/screenshot-sound-1.mp3'
		],
		['d:/data/100% sound?.ogg', 'file:///d:/data/100%25%20sound%3F.ogg'],
		['\\\\server\\share\\sounds\\chime.wav', 'file://server/share/sounds/chime.wav'],
		[
			'/home/j/.config/gauzy/sounds/screenshot-sound-1.ogg',
			'file:///home/j/.config/gauzy/sounds/screenshot-sound-1.ogg'
		],
		[
			'/Users/Ana María/Library/Application Support/gauzy/#1.wav',
			'file:///Users/Ana%20Mar%C3%ADa/Library/Application%20Support/gauzy/%231.wav'
		]
	])('makes a file URL of the path %s', (file, url) => {
		expect(soundFileUrl(file)).toBe(url);
	});

	it.each([
		'file:///C:/sounds/chime.wav',
		'https://cdn.example.com/chime.mp3',
		'data:audio/wav;base64,UklGRg==',
		'assets/sounds/chime.wav'
	])('keeps a URL or a path relative to the page as it is (%s)', (file) => {
		expect(soundFileUrl(file)).toBe(file);
	});
});

describe('SoundFilePlayer', () => {
	let created: { url: string; audio: { play: jest.Mock; pause: jest.Mock } }[];
	let player: SoundFilePlayer;

	beforeEach(() => {
		created = [];
		player = new SoundFilePlayer((url) => {
			const audio = { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn() };
			created.push({ url, audio });
			return audio as unknown as ISoundFileAudio;
		});
	});

	it('plays the file it is given, from its file URL', async () => {
		await player.play('/app/assets/sound.wav');

		expect(created).toHaveLength(1);
		expect(created[0].url).toBe('file:///app/assets/sound.wav');
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

		expect(created.map(({ url }) => url)).toEqual([
			'file:///app/assets/sound.wav',
			'file:///user-data/sounds/screenshot-sound-1.mp3'
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
