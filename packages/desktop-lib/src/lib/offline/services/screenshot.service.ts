
import { AppError } from '../../error-handler';
import { IScreenshotService } from '../../interfaces';
import {  ScreenshotDAO } from '../dao';
import { ScreenshotTO } from '../dto';

export class ScreenshotService implements IScreenshotService<ScreenshotTO> {
	private _screenshotDAO: ScreenshotDAO;

	constructor() {
		this._screenshotDAO = new ScreenshotDAO();
	}

	public async save(screenshot: ScreenshotTO): Promise<void> {
		try {
			if (!screenshot) {
				return console.error('WARN[SCREENSHOT_SERVICE]: No screenshot data, cannot save');
			}
			await this._screenshotDAO.save(screenshot);
		} catch (error) {
			throw new AppError('SCREENSHOT_SERVICE', error);
		}
	}

	public async saveAndReturn(screenshot: ScreenshotTO): Promise<ScreenshotTO | null> {
		try {
			if (!screenshot) {
				console.error('WARN[SCREENSHOT_SERVICE]: No screenshot data, cannot save');
				return null;
			}
			const created = await this._screenshotDAO.saveAndReturn(screenshot);
			return created;
		} catch (error) {
			throw new AppError('SCREENSHOT_SERVICE', error);
		}
	}

	public async update(screenshot: Partial<ScreenshotTO>): Promise<void> {
		try {
			if (!screenshot.id) {
				return console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot update');
			}
			await this._screenshotDAO.update(screenshot.id, screenshot);
		} catch (error) {
			throw new AppError('SCREENSHOT_SERVICE', error);
		}
	}

	public async findById(activity: Partial<ScreenshotTO>): Promise<ScreenshotTO> {
		try {
			if (!activity.id) {
				console.error('WARN[SCREENSHOT_SERVICE]: No screenshot data, cannot find');
				return null;
			}
			return await this._screenshotDAO.findOneById(activity.id);
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async remove(activity: Partial<ScreenshotTO>): Promise<void> {
		try {
			await this._screenshotDAO.delete(activity);
		} catch (error) {
			throw new AppError('SCREENSHOT_SERVICE', error);
		}
	}

	public async findUnsyncScreenshot(): Promise<ScreenshotTO[]> {
		try {
			return await this._screenshotDAO.findUnsyncScreenshot()
		} catch (error) {
			console.error(error);
			return [];
		}
	}
}
