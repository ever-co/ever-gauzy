const moment = require('moment');

// Test function to calculate amount owed
async function calculateAmountOwed(timeLogs, employeeRates) {
    let totalAmountOwed = 0;

    // Process each time log
    for (const timeLog of timeLogs) {
        let currentTime = moment(timeLog.startedAt);
        const logEndTime = moment(timeLog.stoppedAt);

        // Get the oldest rate for the time log
        let rateIdx = employeeRates.findIndex((r) => moment(r.startRatePeriod).isSameOrBefore(timeLog.startedAt));
        while (rateIdx > 0) {
            // Calculate the period end as the minimum of the log end time and the previous rate start time
            const periodEnd = moment.min(logEndTime, moment(employeeRates[rateIdx-1].startRatePeriod));

            // Calculate the period owed amount with the current rate
            const periodDuration = periodEnd.diff(currentTime, 'seconds');
            totalAmountOwed += (periodDuration / 3600) * employeeRates[rateIdx].billRateValue;

            // Move to the next period rate
            rateIdx-=1;
            currentTime = moment(periodEnd);
        }

        // Calculate the remaining amount owed for the time log with the last rate
        if (currentTime.isBefore(logEndTime)) {
            const overlapDuration = logEndTime.diff(currentTime, 'seconds');
            totalAmountOwed += (overlapDuration / 3600) * employeeRates[0].billRateValue;
        }
    }

    return totalAmountOwed;
}

// Test case 1: Single time log with single rate
const test1 = async () => {
    const timeLogs = [{
        startedAt: '2024-03-20T10:00:00Z',
        stoppedAt: '2024-03-20T12:00:00Z'
    }];
    
    const employeeRates = [{
        startRatePeriod: '2024-01-01T00:00:00Z',
        billRateValue: 50
    }];

    const amount = await calculateAmountOwed(timeLogs, employeeRates);
    console.log('Test 1 - Single rate (2 hours at $50/hr):', amount);
};

// Test case 2: Single time log spanning multiple rates
const test2 = async () => {
    const timeLogs = [{
        startedAt: '2024-03-20T10:00:00Z',
        stoppedAt: '2024-03-20T14:00:00Z'
    }];
    
    const employeeRates = [
        {
            startRatePeriod: '2024-03-20T12:00:00Z',
            billRateValue: 60
        },
        {
            startRatePeriod: '2024-01-01T00:00:00Z',
            billRateValue: 50
        }
    ];

    const amount = await calculateAmountOwed(timeLogs, employeeRates);
    console.log('Test 2 - Multiple rates (2 hours at $50/hr + 2 hours at $60/hr):', amount);
};

// Test case 3: Multiple time logs with multiple rates
const test3 = async () => {
    const timeLogs = [
        {
            startedAt: '2024-03-20T10:00:00Z',
            stoppedAt: '2024-03-20T12:00:00Z'
        },
        {
            startedAt: '2024-03-20T13:00:00Z',
            stoppedAt: '2024-03-20T15:00:00Z'
        }
    ];
    
    const employeeRates = [
        {
            startRatePeriod: '2024-03-20T11:00:00Z',
            billRateValue: 60
        },
        {
            startRatePeriod: '2024-01-01T00:00:00Z',
            billRateValue: 50
        }
    ];

    const amount = await calculateAmountOwed(timeLogs, employeeRates);
    console.log('Test 3 - Multiple logs with rate change:', amount);
};

// Run all tests
async function runTests() {
    console.log('Running tests...\n');
    await test1();
    await test2();
    await test3();
}

runTests().catch(console.error); 