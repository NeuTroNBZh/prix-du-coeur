const request = require('supertest');
const express = require('express');
const authRoutes = require('../src/routes/auth');
const pool = require('../src/config/database');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const testUser = {
  email: 'test@example.com',
  password: 'Test1234',
  firstName: 'Test',
  lastName: 'User'
};

describe('Auth API', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    await pool.end();
  });

  test('should register new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
  });

  test('should reject duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(409);
  });

  test('should login successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body).toHaveProperty('token');
  });

  test('should reject invalid password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'Wrong123' })
      .expect(401);
  });
});
