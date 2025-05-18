import * as electron from 'electron';
import * as fs from 'fs';
import * as path from 'node:path';
import * as os from 'os';

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

type TScreenShot = {
	img: Buffer,
	name: string,
	id: string,
	filePath?: string,
	fullScreen: Buffer
}

function saveTempImageStream(screen: TScreenShot): Promise<TScreenShot> {
	return new Promise((resolve, reject) => {
		const buffer = screen.fullScreen;
		const filePath = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
		const writeStream = fs.createWriteStream(filePath);

		writeStream.on('finish', () => resolve({
			...screen,
			filePath
		}));

		writeStream.on('error', reject);

		writeStream.write(buffer);
		writeStream.end();
	});
}

export async function getScreenshot(args: TArgScreen): Promise<TScreenShot[]> {
	try {
		console.log('getscreenshot', args);
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
		})

		const screens = [];

		sources.forEach((source) => {
			if (
				monitor &&
				monitor.captured &&
				monitor.captured === 'active-only'
			) {
				if (args.activeWindow && source.display_id === args.activeWindow.id.toString()) {
					const fullScreen = sourcesFull.find((src) => src.id === source.id);
					screens.push({
						img: source.thumbnail.toPNG(),
						name: source.name,
						id: source.display_id,
						fullScreen: fullScreen.thumbnail.toPNG()
					});
				}
			} else {
				if (args.activeWindow) {
					const fullScreen = sourcesFull.find((src) => src.id === source.id);
					screens.push({
						img: source.thumbnail.toPNG(),
						name: source.name,
						id: source.display_id,
						fullScreen: fullScreen.thumbnail.toPNG()
					});
				}
			}
		});
		const imgs: TScreenShot[] = await Promise.all(screens.map((buffer) => saveTempImageStream(buffer)));
		return imgs;
	} catch (error) {
		console.log('error', error);
		return [];
	}
}
