// environment.tokens.ts
import { InjectionToken } from '@angular/core';
import { Environment } from './model';

export const GAUZY_ENV = new InjectionToken<Environment>('gauzyEnvironment');
