const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, 'config.env'), override: false });

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', require('./routes/student'));
app.use('/api', require('./routes/admin'));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Student Management Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Student Management Backend API',
    version: '1.0.0',
    endpoints: {
      student: '/api (routes/student.js)',
      admin: '/api (routes/admin.js)',
      health: '/health',
    },
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

const start = async () => {
  if (!process.env.JWT_SECRET) {
    console.error('Error: JWT_SECRET is not set in .env or config.env');
    process.exit(1);
  }

  await connectDB();

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
