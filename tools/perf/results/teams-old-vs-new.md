<!-- markdownlint-disable -->

# teams-old vs teams-new

| endpoint | metric | teams-old | teams-new | teams-old→teams-new |
|---|---|---|---|---|
| user-me-teams | seq p50 ms | 21.81 | 18.12 | 1.20× faster |
| user-me-teams | seq p90 ms | 26.16 | 21.42 | 1.22× faster |
| user-me-teams | c8 rps | 80.7 | 101.2 | 1.25× more |
| user-me-teams | c8 p99 ms (n=649/814) | 216.77 | 132.56 | 1.64× faster |
| user-me-teams | SQL ms/req | 0.3 | 0.27 | 1.11× faster |
| user-me-teams | SQL/req | 6 | 6 | 1.00× fewer statements |
| teams-list-members | seq p50 ms | 140.21 | 141.31 | 1.01× slower |
| teams-list-members | seq p90 ms | 161.98 | 159.55 | 1.02× faster |
| teams-list-members | c8 rps | 10.9 | 10.7 | 1.02× less |
| teams-list-members | c8 p99 ms (n=93/89) | 845.25 | 844.31 | 1.00× faster |
| teams-list-members | SQL ms/req | 9.47 | 9.04 | 1.05× faster |
| teams-list-members | SQL/req | 6 | 6 | 1.00× fewer statements |
| team-detail-statistics | seq p50 ms | 154.39 | 157.81 | 1.02× slower |
| team-detail-statistics | seq p90 ms | 177.39 | 181.78 | 1.02× slower |
| team-detail-statistics | c8 rps | 28.1 | 31.4 | 1.12× more |
| team-detail-statistics | c8 p99 ms (n=228/256) | 725.06 | 634.49 | 1.14× faster |
| team-detail-statistics | SQL ms/req | 1.41 | 1.43 | 1.01× slower |
| team-detail-statistics | SQL/req | 12 | 12 | 1.00× fewer statements |
| tasks-team | seq p50 ms | 155.59 | 136.59 | 1.14× faster |
| tasks-team | seq p90 ms | 214.25 | 217.71 | 1.02× slower |
| tasks-team | c8 rps | 30 | 31.6 | 1.05× more |
| tasks-team | c8 p99 ms (n=247/256) | 351.46 | 347.88 | 1.01× faster |
| tasks-team | SQL ms/req | 4.17 | 4.06 | 1.03× faster |
| tasks-team | SQL/req | 6.03 | 6 | 1.01× fewer statements |
| daily-plan-me | seq p50 ms | 281.92 | 134.94 | 2.09× faster |
| daily-plan-me | seq p90 ms | 318.64 | 146.78 | 2.17× faster |
| daily-plan-me | c8 rps | 4.3 | 8.2 | 1.91× more |
| daily-plan-me | c8 p99 ms (n=41/71) | 2545.68 | 1297.76 | 1.96× faster |
| daily-plan-me | SQL ms/req | 41.83 | 3.05 | 13.71× faster |
| daily-plan-me | SQL/req | 5 | 14 | 2.80× more statements |
| daily-plan-team | seq p50 ms | 34.07 | 36.27 | 1.06× slower |
| daily-plan-team | seq p90 ms | 43.11 | 43.45 | 1.01× slower |
| daily-plan-team | c8 rps | 24.3 | 32.9 | 1.35× more |
| daily-plan-team | c8 p99 ms (n=205/269) | 653.35 | 301.57 | 2.17× faster |
| daily-plan-team | SQL ms/req | 5.67 | 1.78 | 3.19× faster |
| daily-plan-team | SQL/req | 5 | 7 | 1.40× more statements |
| timer-status | seq p50 ms | 21.96 | 21.38 | 1.03× faster |
| timer-status | seq p90 ms | 26.23 | 26.15 | 1.00× faster |
| timer-status | c8 rps | 75 | 78.7 | 1.05× more |
| timer-status | c8 p99 ms (n=606/632) | 147.87 | 232.37 | 1.57× slower |
| timer-status | SQL ms/req | 0.29 | 0.28 | 1.04× faster |
| timer-status | SQL/req | 10 | 10.02 | 1.00× more statements |
| time-log-week | seq p50 ms | 115.54 | 98.99 | 1.17× faster |
| time-log-week | seq p90 ms | 138.41 | 126.57 | 1.09× faster |
| time-log-week | c8 rps | 16.6 | 25.7 | 1.55× more |
| time-log-week | c8 p99 ms (n=139/210) | 673.34 | 620.09 | 1.09× faster |
| time-log-week | SQL ms/req | 35.26 | 3.93 | 8.97× faster |
| time-log-week | SQL/req | 5 | 5 | 1.00× fewer statements |
| time-log-month-slots | seq p50 ms | 1254.81 | 150.76 | 8.32× faster |
| time-log-month-slots | seq p90 ms | 1323.8 | 172.73 | 7.66× faster |
| time-log-month-slots | c8 rps | 0.9 | 7.2 | 8.00× more |
| time-log-month-slots | c8 p99 ms (n=9/66) | 8917.99 | 1937.13 | 4.60× faster |
| time-log-month-slots | SQL ms/req | 753.6 | 38.94 | 19.35× faster |
| time-log-month-slots | SQL/req | 5.03 | 5.03 | 1.00× fewer statements |
| statistics-counts | seq p50 ms | 17.16 | 16.99 | 1.01× faster |
| statistics-counts | seq p90 ms | 18.62 | 20.13 | 1.08× slower |
| statistics-counts | c8 rps | 91.7 | 92.6 | 1.01× more |
| statistics-counts | c8 p99 ms (n=739/746) | 144.14 | 131.85 | 1.09× faster |
| statistics-counts | SQL ms/req | 5.06 | 5.1 | 1.01× slower |
| statistics-counts | SQL/req | 8 | 8 | 1.00× fewer statements |
| role-permissions-me | seq p50 ms | 31.01 | 31.13 | 1.00× slower |
| role-permissions-me | seq p90 ms | 36.1 | 37.4 | 1.04× slower |
| role-permissions-me | c8 rps | 33.4 | 33.6 | 1.01× more |
| role-permissions-me | c8 p99 ms (n=273/275) | 441.22 | 424.32 | 1.04× faster |
| role-permissions-me | SQL ms/req | 1.05 | 0.97 | 1.08× faster |
| role-permissions-me | SQL/req | 4 | 4 | 1.00× fewer statements |
