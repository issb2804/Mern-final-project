// Imported first by API tests so config sees the test environment.
process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
