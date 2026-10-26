// `import 'jest-preset-angular'` was the pre-v14 way to set up the Angular test environment; the
// current jest-preset-angular (16) exposes it as `setupZoneTestEnv()`, same as the other Angular apps.
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();
