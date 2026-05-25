import express from "express";
import * as supervisorWorkflowController from "../../controllers/v2/supervisorWorkflowController.js";
import * as acceptanceWorkflowController from "../../controllers/v2/acceptanceWorkflowController.js";
import * as weeklyFollowUpController from "../../controllers/v2/weeklyFollowUpController.js";
import * as dashboardStatsController from "../../controllers/v2/dashboardStatsController.js";
import * as notificationController from "../../controllers/v2/notificationController.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { uploadCV } from "../../middlewares/uploadMiddleware.js";
import { validate } from "../../middlewares/validate.js";
import { createStagiaireSchema, updateStagiaireSchema } from "../../validations/v2/supervisorValidation.js";

const router = express.Router();

router.get("/supervisors/pending-students", authenticate, supervisorWorkflowController.getPendingStagiaires);
router.post(
  "/supervisors/students",
  authenticate,
  uploadCV.single("cv"),
  validate(createStagiaireSchema),
  supervisorWorkflowController.createStagiaire
);
router.put(
  "/supervisors/students/:studentId",
  authenticate,
  uploadCV.single("cv"),
  validate(updateStagiaireSchema),
  supervisorWorkflowController.updateStagiaire
);
router.post("/supervisors/students/accept", authenticate, supervisorWorkflowController.acceptStudent);
router.delete(
  "/supervisors/projects/:projectId/interns/:internId",
  authenticate,
  supervisorWorkflowController.deleteInternFromProject
);

router.get("/students/acceptance-workflows", authenticate, acceptanceWorkflowController.getStudentAcceptanceWorkflows);
router.post("/students/acceptance/confirm", authenticate, acceptanceWorkflowController.confirmAcceptance);

router.get("/students/interns/:internId/follow-ups", authenticate, weeklyFollowUpController.getStudentWeeklyFollowUps);
router.post("/students/interns/follow-up", authenticate, weeklyFollowUpController.submitWeeklyFollowUp);
router.get("/supervisors/projects/:projectId/follow-ups", authenticate, weeklyFollowUpController.getSupervisorFollowUps);

router.get("/dashboard/supervisor", authenticate, dashboardStatsController.getSupervisorDashboardStats);
router.get("/dashboard/student", authenticate, dashboardStatsController.getStudentDashboardStats);
router.get("/dashboard/admin", authenticate, dashboardStatsController.getAdminDashboardStats);

router.get("/notifications/unread-count", authenticate, notificationController.getUnreadNotificationCount);
router.get("/notifications", authenticate, notificationController.getNotifications);
router.patch("/notifications/:notificationId/read", authenticate, notificationController.markNotificationAsRead);
router.patch("/notifications/mark-all-read", authenticate, notificationController.markAllNotificationsAsRead);

router.post("/webhooks/cv-parsed", supervisorWorkflowController.n8nCvParsedWebhook);

export default router;
