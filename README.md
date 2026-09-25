# Student Management Backend

A Node.js backend API for managing UG, PG, and BBA students with MongoDB integration.

## Features

- **Three Student Models**: UG, PG, and BBA students with separate schemas
- **Authentication**: Login using Autonomous Roll No and Date of Birth
- **Admit Card API**: Get student data for admit card generation
- **Data Import**: Bulk import student data to all models
- **JWT Authentication**: Secure API endpoints
- **MongoDB Integration**: Scalable database solution

## Project Structure

```
├── server.js                 # Boot: env, db, cors, mount routes, listen
├── config/
│   └── db.js
├── middleware/
│   ├── auth.js
│   └── adminAuth.js
├── models/                   # Mongoose schemas
├── controllers/              # API handlers (req/res)
├── routes/
│   ├── student.js            # Student login, admit, grades, ABC, fees
│   └── admin.js              # Admin login, ingest, bulk marksheet
├── utils/                    # Shared non-HTTP helpers
├── data/
├── config.env
└── package.json
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd main-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `config.env` and update the values:
   ```env
   MONGO_URI=mongodb://localhost:27017/student_management
   JWT_SECRET=your_jwt_secret_key_here
   PORT=5000
   NODE_ENV=development
   ```

4. **Start MongoDB**
   - Make sure MongoDB is running on your system
   - Or use MongoDB Atlas (cloud service)

5. **Run the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication

- **POST** `/api/auth/login` - Student login
  ```json
  {
    "autonomousRollNo": "NACBBA24-001",
    "dob": "01-01-2005"
  }
  ```

### Students

- **GET** `/api/students/admit-card?autonomousRollNo=NACBBA24-001` - Get admit card data
- **GET** `/api/students/profile` - Get authenticated student profile (requires JWT)
- **GET** `/api/students/search?autonomousRollNo=NACBBA24-001` - Search student

### Data Import

- **POST** `/api/data-import/ug-students` - Import UG students data
- **POST** `/api/data-import/pg-students` - Import PG students data
- **POST** `/api/data-import/bba-students` - Import BBA students data
- **POST** `/api/data-import/all-students` - Import all students data at once
- **GET** `/api/data-import/status` - Get import status

### Health Check

- **GET** `/health` - Server health status
- **GET** `/` - API information

## Data Import Example

To import all students data at once:

```bash
POST /api/data-import/all-students
Content-Type: application/json

{
  "ugStudents": [
    {
      "Department": "ECONOMICS",
      "Sl.No": 1,
      "Autonomous Roll No": "03NAC24001",
      "Name of the Students": "BISWARANJAN SAHOO",
      "Major-3": "Economics",
      "Major-4": "Economics",
      "MINOR-2": "ODIA",
      "Multi Disciplinary-2": "F.L",
      "AEC-2": "ENGLISH",
      "SEC-I": "Q.L.T",
      "Roll No": "BA24-003",
      "dob": "01-01-2005"
    }
  ],
  "pgStudents": [
    {
      "Barcode No.": "24P1005582",
      "College Roll No": "ODIA24-001",
      "Autonomous Roll No": "111NAC24001",
      "Applicant Name": "BARSA NAYAK",
      "DOB": "15-07-2002",
      "Course": "Odia",
      "Graduation Board": "Utkal University"
    }
  ],
  "bbaStudents": [
    {
      "Department": "BBA ",
      "Sl.No": 1,
      "Roll No": "BBA-24-001",
      "Autonomous Roll No": "NACBBA24-001",
      "Name of the Students": "Anil Parida",
      "CC-201": "H.B & O",
      "CC-202": "M.M",
      "CC-203": "B.E",
      "Multi Disciplinary-201": "M.L & C.T",
      "AEC-201": "B.C",
      "SEC-201": "E.T & A",
      "VAC-201-I.C": "ES & S",
      "dob": "01-01-2005"
    }
  ]
}
```

## Frontend Integration

### Login Flow
1. User enters Autonomous Roll No and DOB
2. Frontend calls `/api/auth/login`
3. Backend returns JWT token
4. Frontend stores token and uses it for authenticated requests

### Admit Card Download
1. Frontend calls `/api/students/admit-card?autonomousRollNo=XXX`
2. Backend returns student data
3. Frontend generates and downloads admit card

## Security Features

- JWT token-based authentication
- Password hashing (if needed in future)
- Input validation using express-validator
- CORS enabled for frontend integration
- Environment variable configuration

## Error Handling

The API includes comprehensive error handling:
- Validation errors
- Database connection errors
- Authentication errors
- General server errors

## Development

- **Hot reload**: Use `npm run dev` for development
- **Logging**: Console logging for debugging
- **Environment**: Separate config for development/production

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secret
3. Configure MongoDB Atlas or production MongoDB
4. Set up proper CORS origins
5. Use environment variables for sensitive data

## Support

For any issues or questions, please check the API documentation or contact the development team.

