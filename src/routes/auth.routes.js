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
    // Bank fields are now optional — not required at registration
    accountNumber: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    accountHolderName: z.string().optional().nullable(),
    referralCode: z.string().optional().nullable(),
    vendorType: z.string().optional(),
    hasGst: z.boolean().optional(),
    gstNumber: z.string().optional().nullable(),
    acceptedTerms: z.boolean().optional(),
  }).refine((data) => {
    if (data.role === 'vendor') {
      return (
        !!data.outletName &&
        !!data.address &&
        data.averagePrepTime !== undefined
      );
    }
    return true;
  }, {
    message: "Vendor fields (Outlet Name, Address, Prep Time) are required",
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
