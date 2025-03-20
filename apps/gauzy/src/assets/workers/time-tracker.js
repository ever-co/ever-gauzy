/// <reference lib="webworker" />

// Initialize interval to null
let interval = null;
// retrieve message post from time tracker service
addEventListener('message', ({ data }) => {
	// if timer running, start counter
	if (data.isRunning) {
		interval = setInterval(() => {
			// Pre-increment session and duration values each 1 sec and send to time tracker service
			postMessage({
				session: ++data.session,
				todayWorked: ++data.duration,
				workedThisWeek: ++data.workedThisWeek
			});
		}, 1000);
	} else if (interval) {
		// if timer stopped clear interval
		clearInterval(interval);
	}
});
