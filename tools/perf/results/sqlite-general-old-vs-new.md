<!-- markdownlint-disable -->

# sqlite-general-old vs sqlite-general-new

| endpoint | metric | sqlite-general-old | sqlite-general-new | sqlite-general-old→sqlite-general-new |
|---|---|---|---|---|
| health | seq p50 ms | 5.07 | 4.57 | 1.11× faster |
| health | seq p90 ms | 6.27 | 6.72 | 1.07× slower |
| health | c8 rps | 426.6 | 416 | 1.03× less |
| health | c8 p99 ms (n=3414/3334) | 33.87 | 32.44 | 1.04× faster |
| feature-toggle-definition | seq p50 ms | 0.82 | 0.94 | 1.15× slower |
| feature-toggle-definition | seq p90 ms | 1.18 | 1.23 | 1.04× slower |
| feature-toggle-definition | c8 rps | 943.9 | 1203.1 | 1.27× more |
| feature-toggle-definition | c8 p99 ms (n=7557/9638) | 38.57 | 24.1 | 1.60× faster |
| user-me | seq p50 ms | 3.72 | 4.35 | 1.17× slower |
| user-me | seq p90 ms | 4.98 | 6.2 | 1.24× slower |
| user-me | c8 rps | 232.1 | 239.5 | 1.03× more |
| user-me | c8 p99 ms (n=1864/1923) | 84.42 | 61.57 | 1.37× faster |
| role-permissions-me | seq p50 ms | 15.65 | 15.44 | 1.01× faster |
| role-permissions-me | seq p90 ms | 19.47 | 19.71 | 1.01× slower |
| role-permissions-me | c8 rps | 59.4 | 61.2 | 1.03× more |
| role-permissions-me | c8 p99 ms (n=485/496) | 243.06 | 191.4 | 1.27× faster |
| tags | seq p50 ms | 9.89 | 10.61 | 1.07× slower |
| tags | seq p90 ms | 11.99 | 12.71 | 1.06× slower |
| tags | c8 rps | 87.9 | 89.5 | 1.02× more |
| tags | c8 p99 ms (n=710/725) | 139.94 | 134.65 | 1.04× faster |
| organization-team-me | seq p50 ms | 5.11 | 4.2 | 1.22× faster |
| organization-team-me | seq p90 ms | 6.43 | 4.91 | 1.31× faster |
| organization-team-me | c8 rps | 196.8 | 195.2 | 1.01× less |
| organization-team-me | c8 p99 ms (n=1582/1570) | 75.74 | 103.91 | 1.37× slower |
| projects-pagination | seq p50 ms | 6.36 | 5.45 | 1.17× faster |
| projects-pagination | seq p90 ms | 8.41 | 6.93 | 1.21× faster |
| projects-pagination | c8 rps | 160.3 | 162.6 | 1.01× more |
| projects-pagination | c8 p99 ms (n=1289/1308) | 126.41 | 106.35 | 1.19× faster |
| employees-pagination | seq p50 ms | 8.31 | 8.48 | 1.02× slower |
| employees-pagination | seq p90 ms | 10.22 | 10.89 | 1.07× slower |
| employees-pagination | c8 rps | 115.2 | 121.2 | 1.05× more |
| employees-pagination | c8 p99 ms (n=930/979) | 155.3 | 113.48 | 1.37× faster |
| tasks-pagination | seq p50 ms | 5.41 | 5.23 | 1.03× faster |
| tasks-pagination | seq p90 ms | 6.89 | 6.78 | 1.02× faster |
| tasks-pagination | c8 rps | 174.9 | 184.9 | 1.06× more |
| tasks-pagination | c8 p99 ms (n=1406/1488) | 126.96 | 80.03 | 1.59× faster |
| teams-pagination | seq p50 ms | 4.8 | 5.3 | 1.10× slower |
| teams-pagination | seq p90 ms | 5.75 | 6.94 | 1.21× slower |
| teams-pagination | c8 rps | 173 | 184.9 | 1.07× more |
| teams-pagination | c8 p99 ms (n=1391/1485) | 189.5 | 96.09 | 1.97× faster |
| employee-by-id | seq p50 ms | 4.15 | 4.47 | 1.08× slower |
| employee-by-id | seq p90 ms | 6.03 | 5.73 | 1.05× faster |
| employee-by-id | c8 rps | 206.2 | 201.3 | 1.02× less |
| employee-by-id | c8 p99 ms (n=1657/1616) | 126.7 | 123.71 | 1.02× faster |
