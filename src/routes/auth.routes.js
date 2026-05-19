const express = require('express');
const { register, login } = require('../controllers/auth.controller');
const { validate } = require('../middlewares/validate.middleware');
const z = require('zod');

const router = express.Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    mobile: z.string().regex(/^\d{10}$/, 'Mobile must be exactly 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['vendor'], {
      errorMap: () => ({ message: 'Only vendor registration is supported' })
    }),
    // Vendor specific fields
    outletName: z.string().optional(),
    address: z.string().optional(),
    averagePrepTime: z.number().int().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format').optional(),
    accountHolderName: z.string().optional(),
    referralCode: z.string().optional().nullable(),
  }).refine((data) => {
    if (data.role === 'vendor') {
      return (
        !!data.outletName && 
        !!data.address && 
        data.averagePrepTime !== undefined && 
        !!data.accountNumber && 
        !!data.ifscCode && 
        !!data.accountHolderName
      );
    }
    return true;
  }, {
    message: "All vendor fields (Outlet, Address, Prep Time, Bank Details) are required",
    path: ["role"]
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

module.exports = router;
