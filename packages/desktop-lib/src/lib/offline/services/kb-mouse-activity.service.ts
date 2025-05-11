
import { AppError } from '../../error-handler';
import { IKbMouseActivityService } from '../../interfaces';
import { KbMouseActivityDAO } from '../dao';
import { KbMouseActivityTO } from '../dto';
import { KbMouseActivity } from '../models';

export class KbMouseActivityService implements IKbMouseActivityService<KbMouseActivityTO> {
	private _kbmouseDAO: KbMouseActivityDAO;

	constructor() {
		this._kbmouseDAO = new KbMouseActivityDAO();
	}

	public async save(activities: KbMouseActivityTO): Promise<void> {
		try {
			if (!activities) {
				return console.error('WARN[KB_MOUSE_SERVICE]: No keyboard and mouse data, cannot save');
			}
			await this._kbmouseDAO.save(activities);
		} catch (error) {
			throw new AppError('KBMOUSE_SERVICE', error);
		}
	}

	public async update(activities: Partial<KbMouseActivityTO>): Promise<void> {
		try {
			if (!activities.id) {
				return console.error('WARN[KBMOUSE_SERVICE]: No keyboard and mouse data, cannot update');
			}
			await this._kbmouseDAO.update(activities.id, activities);
		} catch (error) {
			throw new AppError('KBMOUSE_SERVICE', error);
		}
	}

	public async retrieve(): Promise<KbMouseActivityTO> {
		try {
			const activitiesDao = await this._kbmouseDAO.current();
			if (activitiesDao) {
				const activities = new KbMouseActivity(activitiesDao);
				return activities;
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	public async remove(activity: Partial<KbMouseActivityTO>): Promise<void> {
		try {
			await this._kbmouseDAO.delete(activity);
		} catch (error) {
			throw new AppError('KBMOUSE_SERVICE', error);
		}
	}
}
