import { query } from "../../config/db.js";
import { logAudit } from "../../utils/audit.js";
import jwt from "jsonwebtoken";
import { validateStudentSupervisorRelationship } from "../../middleware/referentialIntegrity.js";

const toSkillCsv = (skills) => (Array.isArray(skills) ? skills.map((s) => s.trim()).join(",") : "");

const computeProfileCompleted = (profile) =>
  Boolean(profile.full_name && profile.phone && profile.education && profile.skills && profile.cv_url);

export const getMyProfile = async (req, res, next) => {
  try {
    const result = await query("SELECT * FROM students WHERE user_id = $1", [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const student = result.rows[0];
    
    // Valider l'intégrité référentielle
    try {
      await validateStudentSupervisorRelationship(student.id);
    } catch (integrityError) {
      console.error('Referential integrity violation:', integrityError.message);
      return res.status(400).json({ 
        message: "Student account integrity error: " + integrityError.message,
        code: 'REFERENTIAL_INTEGRITY_ERROR'
      });
    }

    return res.json(student);
  } catch (error) {
    return next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const current = await query("SELECT * FROM students WHERE user_id = $1", [req.user.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const curr = current.rows[0];
    const nextProfile = {
      full_name: req.body.fullName ?? curr.full_name,
      phone: req.body.phone ?? curr.phone,
      education: req.body.education ?? curr.education,
      skills: req.body.skills ? toSkillCsv(req.body.skills) : curr.skills,
      experience: req.body.experience ?? curr.experience,
      cv_url: req.body.cvUrl ?? curr.cv_url,
      preferences: req.body.preferences ?? curr.preferences
    };

    const profileCompleted = computeProfileCompleted(nextProfile);

    const result = await query(
      `UPDATE students
       SET full_name = $1,
           phone = $2,
           education = $3,
           skills = $4,
           experience = $5,
           cv_url = $6,
           preferences = $7,
           profile_completed = $8,
           updated_at = NOW()
       WHERE user_id = $9
       RETURNING *`,
      [
        nextProfile.full_name,
        nextProfile.phone,
        nextProfile.education,
        nextProfile.skills,
        nextProfile.experience,
        nextProfile.cv_url,
        nextProfile.preferences,
        profileCompleted,
        req.user.id
      ]
    );

    await logAudit(req.user.id, "STUDENT_PROFILE_UPDATED", { profileCompleted });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const getMyProgress = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT inr.id AS intern_id, inr.status AS intern_status, inr.start_date, inr.end_date,
              p.id AS project_id, p.title AS project_title, p.description AS project_description,
              t.id AS task_id, t.title AS task_title, t.status AS task_status, t.deadline,
              f.comment AS feedback_comment
       FROM students s
       JOIN interns inr ON inr.student_id = s.id
       JOIN projects p ON p.id = inr.project_id
       LEFT JOIN tasks t ON t.project_id = p.id
       LEFT JOIN feedbacks f ON f.intern_id = inr.id
       WHERE s.user_id = $1
       ORDER BY t.deadline NULLS LAST, t.created_at DESC`,
      [req.user.id]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

export const submitTaskUpdate = async (req, res, next) => {
  try {
    const taskId = req.params.taskId;
    const { progress, status, fileUrl } = req.body;

    const internResult = await query(
      `SELECT inr.id
       FROM interns inr
       JOIN students s ON s.id = inr.student_id
       JOIN tasks t ON t.project_id = inr.project_id
       WHERE s.user_id = $1 AND t.id = $2`,
      [req.user.id, taskId]
    );

    if (internResult.rows.length === 0) {
      return res.status(403).json({ message: "Task does not belong to your assigned project" });
    }

    const internId = internResult.rows[0].id;

    await query(
      `INSERT INTO task_updates (task_id, intern_id, progress, status, file_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [taskId, internId, progress || null, status, fileUrl || null]
    );

    await query("UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2", [status, taskId]);

    await logAudit(req.user.id, "TASK_UPDATE_SUBMITTED", { taskId, status });
    return res.status(201).json({ message: "Task update submitted" });
  } catch (error) {
    return next(error);
  }
};

export const uploadMyCv = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No CV file uploaded" });
    }

    const studentResult = await query("SELECT id FROM students WHERE user_id = $1", [req.user.id]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    await query(
      "INSERT INTO documents (user_id, type, file_url) VALUES ($1, 'cv', $2)",
      [req.user.id, fileUrl]
    );

    const updated = await query(
      `UPDATE students
       SET cv_url = $1,
           profile_completed = CASE
             WHEN full_name IS NOT NULL
               AND phone IS NOT NULL
               AND education IS NOT NULL
               AND COALESCE(skills, '') <> ''
               AND $1 IS NOT NULL
             THEN true
             ELSE profile_completed
           END,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [fileUrl, req.user.id]
    );

    await logAudit(req.user.id, "STUDENT_CV_UPLOADED", { fileUrl });

    return res.status(201).json({
      message: "CV uploaded successfully",
      profile: updated.rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyCvDownloadToken = async (req, res, next) => {
  try {
    const profile = await query("SELECT cv_url FROM students WHERE user_id = $1", [req.user.id]);
    if (profile.rows.length === 0 || !profile.rows[0].cv_url) {
      return res.status(404).json({ message: "CV not found" });
    }

    const token = jwt.sign(
      {
        userId: req.user.id,
        cvUrl: profile.rows[0].cv_url,
        type: "cv_download"
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return res.json({ token, cvUrl: profile.rows[0].cv_url });
  } catch (error) {
    return next(error);
  }
};

export const listStudents = async (req, res, next) => {
  try {
    const values = [];
    const where = ["u.is_active = true"];

    if (req.user?.role === "supervisor") {
      const supervisor = await query("SELECT id FROM supervisors WHERE user_id = $1", [req.user.id]);
      if (supervisor.rows.length === 0) {
        return res.status(404).json({ message: "Supervisor profile not found" });
      }

      values.push(supervisor.rows[0].id);
      where.push(`s.created_by_supervisor_id = $${values.length}`);
    }

    const result = await query(
      `SELECT
         s.id,
         s.full_name,
         s.phone,
         s.education,
         s.skills,
         s.experience,
         s.cv_url,
         s.profile_completed,
         s.updated_at,
         u.email,
         u.is_active,
         u.is_email_verified,
         u.created_at,
         i.id AS assignment_id,
         i.project_id AS assigned_project_id,
         i.status AS assignment_status,
         p.title AS assigned_project_title
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN interns i ON i.student_id = s.id AND i.status IN ('active', 'paused')
       LEFT JOIN projects p ON p.id = i.project_id
       WHERE ${where.join(" AND ")}
       ORDER BY s.full_name NULLS LAST, u.created_at DESC`,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};
