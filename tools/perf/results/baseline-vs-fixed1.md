<!-- markdownlint-disable -->

# baseline vs fixed1

| endpoint | metric | baseline | fixed1 | baseline→fixed1 |
|---|---|---|---|---|
| health | seq p50 ms | 14.08 | 12.93 | 1.09× faster |
| health | seq p90 ms | 18.26 | 14.37 | 1.27× faster |
| health | c16 rps | 129.8 | 128.2 | 1.01× less |
| health | c16 p99 ms | 518.82 | 476.57 | 1.09× faster |
| health | SQL/req | 1 | 1 | 1.00× faster |
| health | Redis/req | 2.02 | 2.02 | 1.00× faster |
| feature-toggle-definition | seq p50 ms | 5.53 | 1.71 | 3.23× faster |
| feature-toggle-definition | seq p90 ms | 6.48 | 2.29 | 2.83× faster |
| feature-toggle-definition | c16 rps | 353.4 | 505.2 | 1.43× more |
| feature-toggle-definition | c16 p99 ms | 77.23 | 55.78 | 1.38× faster |
| feature-toggle-definition | SQL/req | 0 | 0 |  |
| feature-toggle-definition | Redis/req | 1.02 | 0.02 | 51.00× faster |
| user-me | seq p50 ms | 56.03 | 32.41 | 1.73× faster |
| user-me | seq p90 ms | 64.57 | 36.86 | 1.75× faster |
| user-me | c16 rps | 25.4 | 47.1 | 1.85× more |
| user-me | c16 p99 ms | 1533.29 | 860.09 | 1.78× faster |
| user-me | SQL/req | 6 | 5 | 1.20× faster |
| user-me | Redis/req | 1.02 | 0.02 | 51.00× faster |
| role-permissions-me | seq p50 ms | 135.71 | 125.58 | 1.08× faster |
| role-permissions-me | seq p90 ms | 170.84 | 169.29 | 1.01× faster |
| role-permissions-me | c16 rps | 5.1 | 10.9 | 2.14× more |
| role-permissions-me | c16 p99 ms | 6330.83 | 1811.02 | 3.50× faster |
| role-permissions-me | SQL/req | 5 | 4 | 1.25× faster |
| role-permissions-me | Redis/req | 1.02 | 0.02 | 51.00× faster |
| tags | seq p50 ms | 1218.17 | 1049.29 | 1.16× faster |
| tags | seq p90 ms | 1587.11 | 1290.49 | 1.23× faster |
| tags | c16 rps | 3 | 3 | 1.00× more |
| tags | c16 p99 ms | 6430.08 | 6667.36 | 1.04× slower |
| tags | SQL/req | 6.08 | 5.03 | 1.21× faster |
| tags | Redis/req | 1.02 | 0.02 | 51.00× faster |
| organization-team-me | seq p50 ms | 46.67 | 24.6 | 1.90× faster |
| organization-team-me | seq p90 ms | 61.62 | 32.37 | 1.90× faster |
| organization-team-me | c16 rps | 40.9 | 56.4 | 1.38× more |
| organization-team-me | c16 p99 ms | 561.44 | 364.72 | 1.54× faster |
| organization-team-me | SQL/req | 6.03 | 5 | 1.21× faster |
| organization-team-me | Redis/req | 1.02 | 0.02 | 51.00× faster |
| projects-pagination | seq p50 ms | 62.36 | 30.64 | 2.04× faster |
| projects-pagination | seq p90 ms | 110.62 | 33.46 | 3.31× faster |
| projects-pagination | c16 rps | 31.1 | 41.2 | 1.32× more |
| projects-pagination | c16 p99 ms | 746.78 | 519.73 | 1.44× faster |
| projects-pagination | SQL/req | 8 | 7 | 1.14× faster |
| projects-pagination | Redis/req | 1.02 | 0.02 | 51.00× faster |
| employees-pagination | seq p50 ms | 84.78 | 41.2 | 2.06× faster |
| employees-pagination | seq p90 ms | 122.4 | 45.9 | 2.67× faster |
| employees-pagination | c16 rps | 12.5 | 28.7 | 2.30× more |
| employees-pagination | c16 p99 ms | 1668.78 | 778.36 | 2.14× faster |
| employees-pagination | SQL/req | 8 | 7 | 1.14× faster |
| employees-pagination | Redis/req | 1.02 | 0.02 | 51.00× faster |
| tasks-pagination | seq p50 ms | 38.77 | 31.9 | 1.22× faster |
| tasks-pagination | seq p90 ms | 45.31 | 35.33 | 1.28× faster |
| tasks-pagination | c16 rps | 37.7 | 40.5 | 1.07× more |
| tasks-pagination | c16 p99 ms | 570.34 | 626.29 | 1.10× slower |
| tasks-pagination | SQL/req | 8 | 7 | 1.14× faster |
| tasks-pagination | Redis/req | 1.02 | 0.02 | 51.00× faster |
| teams-pagination | seq p50 ms | 44.59 | 23.35 | 1.91× faster |
| teams-pagination | seq p90 ms | 46.91 | 25.99 | 1.80× faster |
| teams-pagination | c16 rps | 32.4 | 52.8 | 1.63× more |
| teams-pagination | c16 p99 ms | 1120.76 | 1519.93 | 1.36× slower |
| teams-pagination | SQL/req | 8 | 7 | 1.14× faster |
| teams-pagination | Redis/req | 1.02 | 0.02 | 51.00× faster |
| employee-by-id | seq p50 ms | 34.79 | 25.65 | 1.36× faster |
| employee-by-id | seq p90 ms | 38.97 | 30.03 | 1.30× faster |
| employee-by-id | c16 rps | 36.7 | 54.6 | 1.49× more |
| employee-by-id | c16 p99 ms | 689.93 | 580.2 | 1.19× faster |
| employee-by-id | SQL/req | 6 | 5 | 1.20× faster |
| employee-by-id | Redis/req | 1.02 | 0.02 | 51.00× faster |
