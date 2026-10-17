<!-- markdownlint-disable -->

# baseline vs fixed3 vs fixed4

| endpoint | metric | baseline | fixed3 | fixed4 | baseline→fixed4 |
|---|---|---|---|---|---|
| health | seq p50 ms | 14.08 | 7.02 | 5.17 | 2.72× faster |
| health | seq p90 ms | 18.26 | 7.92 | 5.73 | 3.19× faster |
| health | c16 rps | 129.8 | 220.2 | 384.2 | 2.96× more |
| health | c16 p99 ms | 518.82 | 156.99 | 67.25 | 7.71× faster |
| health | SQL/req | 1 | 1 | 1 | 1.00× faster |
| health | Redis/req | 2.02 | 2.02 | 2.02 | 1.00× faster |
| feature-toggle-definition | seq p50 ms | 5.53 | 1.89 | 0.81 | 6.83× faster |
| feature-toggle-definition | seq p90 ms | 6.48 | 2.64 | 1.09 | 5.94× faster |
| feature-toggle-definition | c16 rps | 353.4 | 744.3 | 1445.6 | 4.09× more |
| feature-toggle-definition | c16 p99 ms | 77.23 | 35.87 | 20.57 | 3.75× faster |
| feature-toggle-definition | SQL/req | 0 | 0 | 0 |  |
| feature-toggle-definition | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| user-me | seq p50 ms | 56.03 | 18.52 | 10.88 | 5.15× faster |
| user-me | seq p90 ms | 64.57 | 21.5 | 13.34 | 4.84× faster |
| user-me | c16 rps | 25.4 | 72.9 | 133.1 | 5.24× more |
| user-me | c16 p99 ms | 1533.29 | 698.72 | 478.44 | 3.20× faster |
| user-me | SQL/req | 6 | 5 | 5 | 1.20× faster |
| user-me | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| role-permissions-me | seq p50 ms | 135.71 | 43.28 | 27.54 | 4.93× faster |
| role-permissions-me | seq p90 ms | 170.84 | 61.71 | 33.1 | 5.16× faster |
| role-permissions-me | c16 rps | 5.1 | 25.2 | 48.3 | 9.47× more |
| role-permissions-me | c16 p99 ms | 6330.83 | 1147.62 | 798.64 | 7.93× faster |
| role-permissions-me | SQL/req | 5 | 4 | 4 | 1.25× faster |
| role-permissions-me | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| tags | seq p50 ms | 1218.17 | 76.32 | 66.49 | 18.32× faster |
| tags | seq p90 ms | 1587.11 | 84.29 | 72.81 | 21.80× faster |
| tags | c16 rps | 3 | 42.1 | 49.9 | 16.63× more |
| tags | c16 p99 ms | 6430.08 | 861.5 | 774.28 | 8.30× faster |
| tags | SQL/req | 6.08 | 5 | 5 | 1.22× faster |
| tags | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| organization-team-me | seq p50 ms | 46.67 | 21.04 | 12.12 | 3.85× faster |
| organization-team-me | seq p90 ms | 61.62 | 24.19 | 16.11 | 3.82× faster |
| organization-team-me | c16 rps | 40.9 | 72.7 | 136.4 | 3.33× more |
| organization-team-me | c16 p99 ms | 561.44 | 529.32 | 143.85 | 3.90× faster |
| organization-team-me | SQL/req | 6.03 | 5 | 5 | 1.21× faster |
| organization-team-me | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| projects-pagination | seq p50 ms | 62.36 | 22.57 | 14.88 | 4.19× faster |
| projects-pagination | seq p90 ms | 110.62 | 24.49 | 18.3 | 6.04× faster |
| projects-pagination | c16 rps | 31.1 | 58.7 | 103.5 | 3.33× more |
| projects-pagination | c16 p99 ms | 746.78 | 588.86 | 341.73 | 2.19× faster |
| projects-pagination | SQL/req | 8 | 7 | 7 | 1.14× faster |
| projects-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| employees-pagination | seq p50 ms | 84.78 | 32.3 | 27.64 | 3.07× faster |
| employees-pagination | seq p90 ms | 122.4 | 37.65 | 30.46 | 4.02× faster |
| employees-pagination | c16 rps | 12.5 | 44.1 | 60.7 | 4.86× more |
| employees-pagination | c16 p99 ms | 1668.78 | 718.52 | 632.6 | 2.64× faster |
| employees-pagination | SQL/req | 8 | 7 | 7 | 1.14× faster |
| employees-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| tasks-pagination | seq p50 ms | 38.77 | 18.6 | 12.95 | 2.99× faster |
| tasks-pagination | seq p90 ms | 45.31 | 23.21 | 15.72 | 2.88× faster |
| tasks-pagination | c16 rps | 37.7 | 73.6 | 106.5 | 2.82× more |
| tasks-pagination | c16 p99 ms | 570.34 | 488.88 | 192.69 | 2.96× faster |
| tasks-pagination | SQL/req | 8 | 6 | 6 | 1.33× faster |
| tasks-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| teams-pagination | seq p50 ms | 44.59 | 19.44 | 14.44 | 3.09× faster |
| teams-pagination | seq p90 ms | 46.91 | 23.05 | 16.57 | 2.83× faster |
| teams-pagination | c16 rps | 32.4 | 69.2 | 101.5 | 3.13× more |
| teams-pagination | c16 p99 ms | 1120.76 | 501.05 | 211.24 | 5.31× faster |
| teams-pagination | SQL/req | 8 | 7 | 7 | 1.14× faster |
| teams-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| employee-by-id | seq p50 ms | 34.79 | 19.83 | 15.5 | 2.24× faster |
| employee-by-id | seq p90 ms | 38.97 | 22.14 | 17.41 | 2.24× faster |
| employee-by-id | c16 rps | 36.7 | 81.2 | 104.1 | 2.84× more |
| employee-by-id | c16 p99 ms | 689.93 | 502.31 | 491.54 | 1.40× faster |
| employee-by-id | SQL/req | 6 | 5 | 5 | 1.20× faster |
| employee-by-id | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
