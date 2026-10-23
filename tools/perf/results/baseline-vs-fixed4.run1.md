<!-- markdownlint-disable -->

# baseline-run1 vs fixed4-run1

| endpoint | metric | baseline-run1 | fixed4-run1 | baseline-run1→fixed4-run1 |
|---|---|---|---|---|
| health | seq p50 ms | 14.08 | 5.17 | 2.72× faster |
| health | seq p90 ms | 18.26 | 5.73 | 3.19× faster |
| health | c16 rps | 129.8 | 384.2 | 2.96× more |
| health | c16 p99 ms | 518.82 | 67.25 | 7.71× faster |
| health | SQL/req | 1 | 1 | 1.00× faster |
| health | Redis/req | 2 | 2 | 1.00× faster |
| feature-toggle-definition | seq p50 ms | 5.53 | 0.81 | 6.83× faster |
| feature-toggle-definition | seq p90 ms | 6.48 | 1.09 | 5.94× faster |
| feature-toggle-definition | c16 rps | 353.4 | 1445.6 | 4.09× more |
| feature-toggle-definition | c16 p99 ms | 77.23 | 20.57 | 3.75× faster |
| feature-toggle-definition | SQL/req | 0 | 0 |  |
| feature-toggle-definition | Redis/req | 1 | 0 |  |
| user-me | seq p50 ms | 56.03 | 10.88 | 5.15× faster |
| user-me | seq p90 ms | 64.57 | 13.34 | 4.84× faster |
| user-me | c16 rps | 25.4 | 133.1 | 5.24× more |
| user-me | c16 p99 ms | 1533.29 | 478.44 | 3.20× faster |
| user-me | SQL/req | 6 | 5 | 1.20× faster |
| user-me | Redis/req | 1 | 0 |  |
| role-permissions-me | seq p50 ms | 135.71 | 27.54 | 4.93× faster |
| role-permissions-me | seq p90 ms | 170.84 | 33.1 | 5.16× faster |
| role-permissions-me | c16 rps | 5.1 | 48.3 | 9.47× more |
| role-permissions-me | c16 p99 ms | 6330.83 | 798.64 | 7.93× faster |
| role-permissions-me | SQL/req | 5 | 4 | 1.25× faster |
| role-permissions-me | Redis/req | 1 | 0 |  |
| tags | seq p50 ms | 1218.17 | 66.49 | 18.32× faster |
| tags | seq p90 ms | 1587.11 | 72.81 | 21.80× faster |
| tags | c16 rps | 3 | 49.9 | 16.63× more |
| tags | c16 p99 ms | 6430.08 | 774.28 | 8.30× faster |
| tags | SQL/req | 6.08 | 5 | 1.22× faster |
| tags | Redis/req | 1 | 0 |  |
| organization-team-me | seq p50 ms | 46.67 | 12.12 | 3.85× faster |
| organization-team-me | seq p90 ms | 61.62 | 16.11 | 3.82× faster |
| organization-team-me | c16 rps | 40.9 | 136.4 | 3.33× more |
| organization-team-me | c16 p99 ms | 561.44 | 143.85 | 3.90× faster |
| organization-team-me | SQL/req | 6.03 | 5 | 1.21× faster |
| organization-team-me | Redis/req | 1 | 0 |  |
| projects-pagination | seq p50 ms | 62.36 | 14.88 | 4.19× faster |
| projects-pagination | seq p90 ms | 110.62 | 18.3 | 6.04× faster |
| projects-pagination | c16 rps | 31.1 | 103.5 | 3.33× more |
| projects-pagination | c16 p99 ms | 746.78 | 341.73 | 2.19× faster |
| projects-pagination | SQL/req | 8 | 7 | 1.14× faster |
| projects-pagination | Redis/req | 1 | 0 |  |
| employees-pagination | seq p50 ms | 84.78 | 27.64 | 3.07× faster |
| employees-pagination | seq p90 ms | 122.4 | 30.46 | 4.02× faster |
| employees-pagination | c16 rps | 12.5 | 60.7 | 4.86× more |
| employees-pagination | c16 p99 ms | 1668.78 | 632.6 | 2.64× faster |
| employees-pagination | SQL/req | 8 | 7 | 1.14× faster |
| employees-pagination | Redis/req | 1 | 0 |  |
| tasks-pagination | seq p50 ms | 38.77 | 12.95 | 2.99× faster |
| tasks-pagination | seq p90 ms | 45.31 | 15.72 | 2.88× faster |
| tasks-pagination | c16 rps | 37.7 | 106.5 | 2.82× more |
| tasks-pagination | c16 p99 ms | 570.34 | 192.69 | 2.96× faster |
| tasks-pagination | SQL/req | 8 | 6 | 1.33× faster |
| tasks-pagination | Redis/req | 1 | 0 |  |
| teams-pagination | seq p50 ms | 44.59 | 14.44 | 3.09× faster |
| teams-pagination | seq p90 ms | 46.91 | 16.57 | 2.83× faster |
| teams-pagination | c16 rps | 32.4 | 101.5 | 3.13× more |
| teams-pagination | c16 p99 ms | 1120.76 | 211.24 | 5.31× faster |
| teams-pagination | SQL/req | 8 | 7 | 1.14× faster |
| teams-pagination | Redis/req | 1 | 0 |  |
| employee-by-id | seq p50 ms | 34.79 | 15.5 | 2.24× faster |
| employee-by-id | seq p90 ms | 38.97 | 17.41 | 2.24× faster |
| employee-by-id | c16 rps | 36.7 | 104.1 | 2.84× more |
| employee-by-id | c16 p99 ms | 689.93 | 491.54 | 1.40× faster |
| employee-by-id | SQL/req | 6 | 5 | 1.20× faster |
| employee-by-id | Redis/req | 1 | 0 |  |
