import * as electron from 'electron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

type TArgScreen = {
	monitor: {
		captured: string
	},
	screenSize: {
		width: number,
		height: number
	},
	activeWindow: {
		id: number,
		index?: number
	}
}

export type TScreenShot = {
	img: Buffer,
	name: string,
	id: string,
	filePath?: string,
	fullScreen: Buffer
}


async function saveTempImage(screen: TScreenShot): Promise<TScreenShot> {
	const buffer = screen.fullScreen;
	const dir = path.join(electron.app.getPath("userData"), "screenshots");
	const filePath = path.join(dir, `screenshot-${randomUUID()}.png`);

	await fs.writeFile(filePath, buffer);
	return {
		...screen,
		filePath,
	};
}

export async function getScreenshot(args: TArgScreen): Promise<TScreenShot[]> {
	try {
		const monitor = args.monitor;
		const thumbSize = {
			width: 320,
			height: 240
		};

		const sources = await electron.desktopCapturer.getSources({
			types: ['screen'],
			thumbnailSize: thumbSize
		});

		const sourcesFull = await electron.desktopCapturer.getSources({
			types: ['screen'],
			thumbnailSize: args.screenSize
		});

		let selected = sources;
		if (monitor?.captured === 'active-only') {
			const matched = args.activeWindow
				? sources.filter((source) => source.display_id === args.activeWindow.id.toString())
				: [];
			// `display_id` is empty on some Linux setups (X11 as well as Wayland), so the active monitor
			// can never be matched and "active-only" silently produced no screenshot at all (#7771).
			// Only trust the filter when it actually matched. Otherwise still capture ONE monitor, never
			// every monitor the user chose not to capture: the source at the active display's index
			// (desktopCapturer lists screens in display order), else the first one.
			const fallback = sources[args.activeWindow?.index ?? 0] ?? sources[0];
			selected = matched.length > 0 ? matched : fallback ? [fallback] : [];
		}

		const screens = selected.flatMap((source) => {
			const fullScreen = sourcesFull.find((src) => src.id === source.id);
			return fullScreen
				? [
						{
							img: source.thumbnail.toPNG(),
							name: source.name,
							id: source.display_id,
							fullScreen: fullScreen.thumbnail.toPNG()
						}
				  ]
				: [];
		});
		const imgs: TScreenShot[] = await Promise.all(screens.map((buffer) => saveTempImage(buffer)));
		return imgs;
	} catch (error) {
		console.log('Error capturing screenshot:', error);
		return [];
	}
}
