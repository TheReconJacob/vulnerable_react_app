import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter } from 'k6/metrics';

const errors = new Counter('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 500 },  // Stay at 500 users
    { duration: '2m', target: 1000 }, // Spike to 1000 users
    { duration: '1m', target: 100 },  // Scale down to 100
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
    errors: ['count<500'],             // Less than 500 errors
  },
};

const BASE_URL = 'http://localhost:5000';

export default function StressTest() {  
  // 1. Register new user
  const username = `stressuser_${Math.random()}`;
  const registerRes = http.post(`${BASE_URL}/register`, 
    JSON.stringify({
      username: username,
      password: 'stress123'
    }), 
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(registerRes, {
    'register successful': (r) => r.status === 200,
  }) || errors.add(1);

  sleep(1);

  // 2. Login with new user
  const loginRes = http.post(`${BASE_URL}/login`,
    JSON.stringify({
      username: username,
      password: 'stress123'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = loginRes.json('token');
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
    'received token': (r) => token !== undefined,
  }) || errors.add(1);

  sleep(1);

  // 3. Access protected route with authentication
  if (token) {
    const protectedRes = http.get(`${BASE_URL}/protected`,
      { headers: { 'Authorization': token } }
    );

    check(protectedRes, {
      'protected route accessible': (r) => r.status === 200,
    }) || errors.add(1);
  }

  // 4. Simulate concurrent database operations
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push({
      method: 'POST',
      url: `${BASE_URL}/register`,
      body: JSON.stringify({
        username: `bulk_user_${Math.random()}`,
        password: 'bulk123'
      }),
      params: {
        headers: { 'Content-Type': 'application/json' }
      }
    });
  }

  const responses = http.batch(requests);
  responses.forEach(response => {
    check(response, {
      'bulk operation successful': (r) => r.status === 200 || r.status === 400,
    }) || errors.add(1);
  });

  sleep(2);
}
