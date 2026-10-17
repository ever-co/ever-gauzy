| endpoint | metric | baseline | fixed1 | fixed3 | baseline→fixed3 |
|---|---|---|---|---|---|
| health | seq p50 ms | 14.08 | 12.93 | 7.02 | 2.01× faster |
| health | seq p90 ms | 18.26 | 14.37 | 7.92 | 2.31× faster |
| health | c16 rps | 129.8 | 128.2 | 220.2 | 1.70× more |
| health | c16 p99 ms | 518.82 | 476.57 | 156.99 | 3.30× faster |
| health | SQL/req | 1 | 1 | 1 | 1.00× faster |
| health | Redis/req | 2.02 | 2.02 | 2.02 | 1.00× faster |
| feature-toggle-definition | seq p50 ms | 5.53 | 1.71 | 1.89 | 2.93× faster |
| feature-toggle-definition | seq p90 ms | 6.48 | 2.29 | 2.64 | 2.45× faster |
| feature-toggle-definition | c16 rps | 353.4 | 505.2 | 744.3 | 2.11× more |
| feature-toggle-definition | c16 p99 ms | 77.23 | 55.78 | 35.87 | 2.15× faster |
| feature-toggle-definition | SQL/req | 0 | 0 | 0 |  |
| feature-toggle-definition | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| user-me | seq p50 ms | 56.03 | 32.41 | 18.52 | 3.03× faster |
| user-me | seq p90 ms | 64.57 | 36.86 | 21.5 | 3.00× faster |
| user-me | c16 rps | 25.4 | 47.1 | 72.9 | 2.87× more |
| user-me | c16 p99 ms | 1533.29 | 860.09 | 698.72 | 2.19× faster |
| user-me | SQL/req | 6 | 5 | 5 | 1.20× faster |
| user-me | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| role-permissions-me | seq p50 ms | 135.71 | 125.58 | 43.28 | 3.14× faster |
| role-permissions-me | seq p90 ms | 170.84 | 169.29 | 61.71 | 2.77× faster |
| role-permissions-me | c16 rps | 5.1 | 10.9 | 25.2 | 4.94× more |
| role-permissions-me | c16 p99 ms | 6330.83 | 1811.02 | 1147.62 | 5.52× faster |
| role-permissions-me | SQL/req | 5 | 4 | 4 | 1.25× faster |
| role-permissions-me | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| tags | seq p50 ms | 1218.17 | 1049.29 | 76.32 | 15.96× faster |
| tags | seq p90 ms | 1587.11 | 1290.49 | 84.29 | 18.83× faster |
| tags | c16 rps | 3 | 3 | 42.1 | 14.03× more |
| tags | c16 p99 ms | 6430.08 | 6667.36 | 861.5 | 7.46× faster |
| tags | SQL/req | 6.08 | 5.03 | 5 | 1.22× faster |
| tags | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| organization-team-me | seq p50 ms | 46.67 | 24.6 | 21.04 | 2.22× faster |
| organization-team-me | seq p90 ms | 61.62 | 32.37 | 24.19 | 2.55× faster |
| organization-team-me | c16 rps | 40.9 | 56.4 | 72.7 | 1.78× more |
| organization-team-me | c16 p99 ms | 561.44 | 364.72 | 529.32 | 1.06× faster |
| organization-team-me | SQL/req | 6.03 | 5 | 5 | 1.21× faster |
| organization-team-me | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| projects-pagination | seq p50 ms | 62.36 | 30.64 | 22.57 | 2.76× faster |
| projects-pagination | seq p90 ms | 110.62 | 33.46 | 24.49 | 4.52× faster |
| projects-pagination | c16 rps | 31.1 | 41.2 | 58.7 | 1.89× more |
| projects-pagination | c16 p99 ms | 746.78 | 519.73 | 588.86 | 1.27× faster |
| projects-pagination | SQL/req | 8 | 7 | 7 | 1.14× faster |
| projects-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| employees-pagination | seq p50 ms | 84.78 | 41.2 | 32.3 | 2.62× faster |
| employees-pagination | seq p90 ms | 122.4 | 45.9 | 37.65 | 3.25× faster |
| employees-pagination | c16 rps | 12.5 | 28.7 | 44.1 | 3.53× more |
| employees-pagination | c16 p99 ms | 1668.78 | 778.36 | 718.52 | 2.32× faster |
| employees-pagination | SQL/req | 8 | 7 | 7 | 1.14× faster |
| employees-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| tasks-pagination | seq p50 ms | 38.77 | 31.9 | 18.6 | 2.08× faster |
| tasks-pagination | seq p90 ms | 45.31 | 35.33 | 23.21 | 1.95× faster |
| tasks-pagination | c16 rps | 37.7 | 40.5 | 73.6 | 1.95× more |
| tasks-pagination | c16 p99 ms | 570.34 | 626.29 | 488.88 | 1.17× faster |
| tasks-pagination | SQL/req | 8 | 7 | 6 | 1.33× faster |
| tasks-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| teams-pagination | seq p50 ms | 44.59 | 23.35 | 19.44 | 2.29× faster |
| teams-pagination | seq p90 ms | 46.91 | 25.99 | 23.05 | 2.04× faster |
| teams-pagination | c16 rps | 32.4 | 52.8 | 69.2 | 2.14× more |
| teams-pagination | c16 p99 ms | 1120.76 | 1519.93 | 501.05 | 2.24× faster |
| teams-pagination | SQL/req | 8 | 7 | 7 | 1.14× faster |
| teams-pagination | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
| employee-by-id | seq p50 ms | 34.79 | 25.65 | 19.83 | 1.75× faster |
| employee-by-id | seq p90 ms | 38.97 | 30.03 | 22.14 | 1.76× faster |
| employee-by-id | c16 rps | 36.7 | 54.6 | 81.2 | 2.21× more |
| employee-by-id | c16 p99 ms | 689.93 | 580.2 | 502.31 | 1.37× faster |
| employee-by-id | SQL/req | 6 | 5 | 5 | 1.20× faster |
| employee-by-id | Redis/req | 1.02 | 0.02 | 0.02 | 51.00× faster |
