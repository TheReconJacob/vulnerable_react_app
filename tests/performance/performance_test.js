import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter } from 'k6/metrics';

const failedRequests = new Counter('failed_requests');

export let options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    failed_requests: ['count<100'],
  },
};

export default function PerformanceTest() {
  const username = `perfuser_${Math.random()}`;
  const password = 'test123';

  // Test registration
  const registerRes = http.post('http://localhost:5000/register', 
    JSON.stringify({
      username: username,
      password: password
    }), 
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(registerRes, {
    'register status is 200': (r) => r.status === 200,
    'register response time < 200ms': (r) => r.timings.duration < 200,
  }) || failedRequests.add(1);

  sleep(1);

  // Test login with the same credentials
  const loginRes = http.post('http://localhost:5000/login',
    JSON.stringify({
      username: username,
      password: password
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = loginRes.json('token');
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login response time < 300ms': (r) => r.timings.duration < 300,
    'login returns token': (r) => token !== undefined,
  }) || failedRequests.add(1);

  sleep(1);

  // Test protected endpoint
  if (token) {
    const protectedRes = http.get('http://localhost:5000/protected',
      { headers: { 'Authorization': token } }
    );

    check(protectedRes, {
      'protected route status is 200': (r) => r.status === 200,
      'protected response time < 400ms': (r) => r.timings.duration < 400,
    }) || failedRequests.add(1);
  }

  sleep(1);
}
