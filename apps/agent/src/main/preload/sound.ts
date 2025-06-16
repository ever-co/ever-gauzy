import { ipcRenderer } from 'electron';
import * as fs from 'node:fs';
const isNotificationWindow = location.hash.startsWith('#/screen-capture');


const soundCache: Record<string, AudioBuffer> = {};
let audioContext: AudioContext;
async function loadSound(pathUrl: string) {
	if (soundCache[pathUrl]) {
		return soundCache[pathUrl];
	}
	if (!audioContext) {
		audioContext = new AudioContext();
	}

	try {
		const fileBuffer = fs.readFileSync(pathUrl);

		// Decode using AudioContext
		const arrayBuffer = fileBuffer.buffer.slice(
			fileBuffer.byteOffset,
			fileBuffer.byteOffset + fileBuffer.byteLength
		);
		const decoded = await audioContext.decodeAudioData(arrayBuffer);
		soundCache[pathUrl] = decoded;
		return decoded;
	} catch (error) {
		console.log('error loaded sound', error);
		// ignore error when audio loaded error to prevent breaking application
	}
}

export async function playSound(_: unknown, arg: { soundFile: string }) {
	try {
		const buffer = await loadSound(arg.soundFile);
		if (!buffer) {
			return; // nothing to play
		}
		const source = audioContext.createBufferSource();
		source.buffer = buffer;
		source.connect(audioContext.destination);
		source.start();
	} catch (error) {
		console.log('error sound', error);
		// use silent error to prevent application breaking
	}
}

if (isNotificationWindow) {
	ipcRenderer.removeListener('play_sound', playSound);
	ipcRenderer.on('play_sound', playSound);
}
