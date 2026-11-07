<!-- markdownlint-disable -->

# sqlite-teams-old vs sqlite-teams-new

| endpoint | metric | sqlite-teams-old | sqlite-teams-new | sqlite-teams-old→sqlite-teams-new |
|---|---|---|---|---|
| user-me-teams | seq p50 ms | 8.8 | 8.02 | 1.10× faster |
| user-me-teams | seq p90 ms | 11.76 | 14.74 | 1.25× slower |
| user-me-teams | c8 rps | 130.5 | 167.2 | 1.28× more |
| user-me-teams | c8 p99 ms (n=1050/1352) | 172.64 | 82.54 | 2.09× faster |
| teams-list-members | seq p50 ms | 71.93 | 53.72 | 1.34× faster |
| teams-list-members | seq p90 ms | 147.61 | 66.34 | 2.23× faster |
| teams-list-members | c8 rps | 11.6 | 18.3 | 1.58× more |
| teams-list-members | c8 p99 ms (n=104/154) | 1714.24 | 546.65 | 3.14× faster |
| team-detail-statistics | seq p50 ms | 20.04 | 16.21 | 1.24× faster |
| team-detail-statistics | seq p90 ms | 23.46 | 19.21 | 1.22× faster |
| team-detail-statistics | c8 rps | 47.1 | 59.2 | 1.26× more |
| team-detail-statistics | c8 p99 ms (n=385/481) | 401.5 | 347.84 | 1.15× faster |
| tasks-team | seq p50 ms | 24.06 | 19.94 | 1.21× faster |
| tasks-team | seq p90 ms | 37.99 | 23.31 | 1.63× faster |
| tasks-team | c8 rps | 42.7 | 45.2 | 1.06× more |
| tasks-team | c8 p99 ms (n=350/368) | 265.97 | 243.31 | 1.09× faster |
| daily-plan-me | seq p50 ms | 196.87 | 87.38 | 2.25× faster |
| daily-plan-me | seq p90 ms | 339 | 99.08 | 3.42× faster |
| daily-plan-me | c8 rps | 5.1 | 11.4 | 2.24× more |
| daily-plan-me | c8 p99 ms (n=47/99) | 1722.49 | 766.32 | 2.25× faster |
| daily-plan-team | seq p50 ms | 19.11 | 14.34 | 1.33× faster |
| daily-plan-team | seq p90 ms | 28.77 | 16.13 | 1.78× faster |
| daily-plan-team | c8 rps | 54.3 | 59.5 | 1.10× more |
| daily-plan-team | c8 p99 ms (n=442/484) | 284.73 | 228.72 | 1.24× faster |
| timer-status | seq p50 ms | 6.52 | 5.53 | 1.18× faster |
| timer-status | seq p90 ms | 8.3 | 7.37 | 1.13× faster |
| timer-status | c8 rps | 152.4 | 157.8 | 1.04× more |
| timer-status | c8 p99 ms (n=1227/1272) | 155.37 | 218.41 | 1.41× slower |
| time-log-week | seq p50 ms | 196.58 | 174.18 | 1.13× faster |
| time-log-week | seq p90 ms | 213.57 | 189.03 | 1.13× faster |
| time-log-week | c8 rps | 4.6 | 5.7 | 1.24× more |
| time-log-week | c8 p99 ms (n=44/53) | 2213.29 | 1497.07 | 1.48× faster |
| time-log-month-slots | seq p50 ms | 1491.77 | 459.86 | 3.24× faster |
| time-log-month-slots | seq p90 ms | 1742.47 | 512.25 | 3.40× faster |
| time-log-month-slots | c8 rps | 0.7 | 2.2 | 3.14× more |
| time-log-month-slots | c8 p99 ms (n=13/25) | 12218.04 | 3763.28 | 3.25× faster |
| statistics-counts | seq p50 ms | 17.8 | 18.31 | 1.03× slower |
| statistics-counts | seq p90 ms | 19.41 | 24.37 | 1.26× slower |
| statistics-counts | c8 rps | 52.7 | 55.9 | 1.06× more |
| statistics-counts | c8 p99 ms (n=428/455) | 362.6 | 228.36 | 1.59× faster |
| role-permissions-me | seq p50 ms | 16.19 | 16.61 | 1.03× slower |
| role-permissions-me | seq p90 ms | 18.5 | 20.33 | 1.10× slower |
| role-permissions-me | c8 rps | 56.2 | 62.8 | 1.12× more |
| role-permissions-me | c8 p99 ms (n=456/509) | 270.02 | 177.75 | 1.52× faster |
