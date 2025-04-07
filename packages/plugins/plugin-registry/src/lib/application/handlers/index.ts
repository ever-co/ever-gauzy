import { commands } from './commands';
import { queries } from './queries';

export const handlers = [...commands, ...queries];
