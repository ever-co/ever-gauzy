import { IDesktopUpdate } from '../../interfaces/i-desktop-update';
import { UpdateStrategy } from '../abstracts/update-strategy';

export class LocalUpdate extends UpdateStrategy implements IDesktopUpdate {
    public get url(): string {
        return this._url;
    }
    public set url(value: string) {
        this._url = value;
    }
}
