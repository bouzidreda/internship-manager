import express from "express";
import {
  deleteUser,
  getAssignmentStatusDistribution,
  getUsersDistribution,
  listCompanyRhProfiles,
  listStudentProfiles,
  listSupervisors,
  listUsers,
  suspendUser
} from "../../controllers/v2/adminController.js";
import { authenticate, authorize } from "../../middlewares/authMiddleware.js";
import { validate } from "../../middlewares/validate.js";
import { suspendUserSchema } from "../../validations/v2/adminValidation.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));// this line forcres so the next routes can't be acessible unless its passed through authorize and authenticate funcitons.

router.get("/users", listUsers);
router.patch("/users/:userId/status", validate(suspendUserSchema), suspendUser);
router.delete("/users/:userId", deleteUser);
router.get("/companies-rh", listCompanyRhProfiles);
router.get("/students", listStudentProfiles);
router.get("/supervisors", listSupervisors);
router.get("/analytics/users-distribution", getUsersDistribution);
router.get("/analytics/assignment-status", getAssignmentStatusDistribution);

export default router;
