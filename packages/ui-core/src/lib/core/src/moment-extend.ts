import * as momentDefault from 'moment';
import { extendMoment } from 'moment-range';

export const moment = extendMoment(momentDefault);

// Use the 'months()' method to get an array of month names
const months = momentDefault.months();

// Export the 'months' array for use in other parts of the code
export { months };
