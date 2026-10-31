
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '30s', target: 1000 },
    { duration: '1m', target: 5000 },
    { duration: '1m', target: 10000 },
    { duration: '30s', target: 10000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const url =
    (__ENV.K6_TARGET_URL || 'http://host.docker.internal:8080') +
    '/api/v1/health';

  const response = http.get(url, {
    timeout: '10s',
  });

  check(response, {
    'HTTP status 200': (r) => r.status === 200,
  });

  sleep(1);
}
