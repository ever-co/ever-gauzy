import { IDesktopUpdate } from '../../interfaces/i-desktop-update';
import { UpdateStrategy } from '../abstracts/update-strategy';

export class LocalUpdate extends UpdateStrategy implements IDesktopUpdate {
    public get url(): string {
        throw new Error('Method not implemented.');
    }
    public set url(value: string) {
        throw new Error('Method not implemented.');
    }
}
