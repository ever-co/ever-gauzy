import * as electron from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

type TArgScreen = {
	monitor: {
		captured: string
	},
	screenSize: {
		width: number,
		height: number
	},
	activeWindow: {
		id: number
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
	const tempPath = electron.app.getPath('temp');
	const filePath = path.join(tempPath, `screenshot-${Date.now()}.png`);
	fs.writeFileSync(filePath, buffer);
	return {
		...screen,
		filePath
	}
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

		const screens = [];

		sources.forEach((source) => {
			if (monitor?.captured === 'active-only') {
				if (args.activeWindow && source.display_id === args.activeWindow.id.toString()) {
					const fullScreen = sourcesFull.find((src) => src.id === source.id);
					if (fullScreen) {
						screens.push({
							img: source.thumbnail.toPNG(),
							name: source.name,
							id: source.display_id,
							fullScreen: fullScreen.thumbnail.toPNG()
						});
					}
				}
			} else {
				const fullScreen = sourcesFull.find((src) => src.id === source.id);
				if (fullScreen) {
					screens.push({
						img: source.thumbnail.toPNG(),
						name: source.name,
						id: source.display_id,
						fullScreen: fullScreen.thumbnail.toPNG()
					});
				}
			}
		});
		const imgs: TScreenShot[] = await Promise.all(screens.map((buffer) => saveTempImage(buffer)));
		return imgs;
	} catch (error) {
		console.log('Error capturing screenshot:', error);
		return [];
	}
}
