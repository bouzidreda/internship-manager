import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool, { query } from "../../config/db.js";
import { sendMail } from "../../utils/mailer.js";

const getSupervisor = async (userId) => {
  const supervisor = await query("SELECT * FROM supervisors WHERE user_id = $1", [userId]);
  return supervisor.rows[0] || null;
};

const getAppBaseUrl = () => process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || "http://localhost:5173";

const hashToken = (rawToken) => crypto.createHash("sha256").update(rawToken).digest("hex");

const issuePasswordResetToken = async (client, userId) => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  await client.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
    [userId, tokenHash]
  );

  return rawToken;
};

const sendPasswordSetupMail = async (email, rawToken) => {
  const resetUrl = `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

  await sendMail({
    to: email,
    subject: "Set your StageFlow password",
    text: `Your stagiaire account is ready. Set your password here: ${resetUrl}`,
    html: `<p>Your stagiaire account is ready.</p><p>Set your password here:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p>`
  });
};

const buildProjectNotificationText = (projectTitle, projectDescription, taskTitles) => {
  const lines = [
    `Your StageFlow project is ready: ${projectTitle}`,
    projectDescription ? `Description: ${projectDescription}` : null,
    taskTitles.length > 0 ? "Tasks:" : null,
    taskTitles.length > 0 ? taskTitles.map((task, index) => `${index + 1}. ${task}`).join("\n") : null
  ].filter(Boolean);

  return lines.join("\n\n");
};

const normalizeSkills = (skills) => {
  if (Array.isArray(skills)) {
    return skills.map((skill) => String(skill).trim()).filter(Boolean).join(",");
  }

  return typeof skills === "string" ? skills.trim() : "";
};

const computeProfileCompleted = (profile) =>
  Boolean(profile.full_name && profile.phone && profile.education && profile.skills && profile.cv_url);

/** Stagiaires created by this supervisor who are not on an active or paused assignment. */
export const getPendingStagiaires = async (req, res, next) => {
  try {
    const supervisor = await getSupervisor(req.user.id);
    if (!supervisor) {
      return res.status(403).json({ error: "Not authorized as supervisor" });
    }

    const rows = await query(
      `SELECT
         s.id,
         s.full_name,
         u.email,
         s.phone,
         s.education,
         s.skills,
         s.cv_url,
         s.profile_completed,
         s.created_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.created_by_supervisor_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM interns i
           WHERE i.student_id = s.id AND i.status IN ('active', 'paused')
         )
       ORDER BY s.created_at DESC`,
      [supervisor.id]
    );

    return res.json(rows.rows);
  } catch (error) {
    return next(error);
  }
};

/** Create a stagiaire (student profile) without assigning a project. */
export const createStagiaire = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { email, fullName, phone, education, skills, experience } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const resolvedFullName =
      typeof fullName === "string" && fullName.trim()
        ? fullName.trim()
        : normalizedEmail.split("@")[0] || "Stagiaire";

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const supervisor = await getSupervisor(req.user.id);
    if (!supervisor) {
      return res.status(403).json({ error: "Not authorized as supervisor" });
    }

    await client.query("BEGIN");

    const existingUser = await client.query("SELECT id, role FROM users WHERE email = $1", [normalizedEmail]);

    if (existingUser.rows.length > 0 && existingUser.rows[0].role !== "student") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Email already used by a non-student account" });
    }

    let studentUserId = null;
    let shouldSendPasswordSetup = false;

    if (existingUser.rows.length === 0) {
      const randomPassword = crypto.randomBytes(12).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const userInsert = await client.query(
        `INSERT INTO users (email, password_hash, role, is_active, is_email_verified)
         VALUES ($1, $2, 'student', true, true)
         RETURNING id`,
        [normalizedEmail, passwordHash]
      );
      studentUserId = userInsert.rows[0].id;
      shouldSendPasswordSetup = true;
    } else {
      studentUserId = existingUser.rows[0].id;
      await client.query(
        "UPDATE users SET is_active = true, is_email_verified = true WHERE id = $1",
        [studentUserId]
      );
    }

    const existingStudent = await client.query(
      `SELECT s.id, s.created_by_supervisor_id
       FROM students s
       WHERE s.user_id = $1`,
      [studentUserId]
    );

    if (existingStudent.rows.length > 0) {
      if (existingStudent.rows[0].created_by_supervisor_id !== supervisor.id) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This student is already registered under another supervisor" });
      }

      if (req.file) {
        const fileUrl = `/uploads/${req.file.filename}`;
        await client.query(
          `UPDATE students
           SET cv_url = $1,
               full_name = COALESCE($2, full_name),
               phone = COALESCE($3, phone),
               education = COALESCE($4, education),
               skills = COALESCE($5, skills),
               experience = COALESCE($6, experience),
               updated_at = NOW()
           WHERE id = $7`,
          [
            fileUrl,
            resolvedFullName || null,
            phone || null,
            education || null,
            Array.isArray(skills) ? skills.join(",") : typeof skills === "string" ? skills : null,
            experience || null,
            existingStudent.rows[0].id
          ]
        );
      } else {
        await client.query(
          `UPDATE students
           SET full_name = COALESCE($1, full_name),
               phone = COALESCE($2, phone),
               education = COALESCE($3, education),
               skills = COALESCE($4, skills),
               experience = COALESCE($5, experience),
               updated_at = NOW()
           WHERE id = $6`,
          [
            resolvedFullName || null,
            phone || null,
            education || null,
            Array.isArray(skills) ? skills.join(",") : typeof skills === "string" ? skills : null,
            experience || null,
            existingStudent.rows[0].id
          ]
        );
      }

      const refreshed = await client.query(
        `SELECT full_name, phone, education, skills, cv_url FROM students WHERE id = $1`,
        [existingStudent.rows[0].id]
      );
      await client.query(
        `UPDATE students
         SET profile_completed = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [computeProfileCompleted(refreshed.rows[0]), existingStudent.rows[0].id]
      );

      await client.query("COMMIT");
      return res.status(200).json({ studentId: existingStudent.rows[0].id, existing: true });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const skillsCsv = Array.isArray(skills) ? skills.join(",") : typeof skills === "string" ? skills : "";

    const studentInsert = await client.query(
      `INSERT INTO students
         (user_id, created_by_supervisor_id, full_name, phone, education, skills, experience, cv_url, profile_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        studentUserId,
        supervisor.id,
        resolvedFullName,
        phone || null,
        education || null,
        skillsCsv,
        experience || null,
        fileUrl,
        computeProfileCompleted({
          full_name: resolvedFullName,
          phone: phone || null,
          education: education || null,
          skills: skillsCsv,
          cv_url: fileUrl
        })
      ]
    );

    const studentId = studentInsert.rows[0].id;
    let passwordSetupToken = null;

    shouldSendPasswordSetup = true;

    if (shouldSendPasswordSetup) {
      passwordSetupToken = await issuePasswordResetToken(client, studentUserId);
    }

    await client.query("COMMIT");

    let warning = null;
    if (shouldSendPasswordSetup && passwordSetupToken) {
      try {
        await sendPasswordSetupMail(normalizedEmail, passwordSetupToken);
      } catch {
        warning = "Password setup email failed to send";
      }
    }

    return res.status(201).json({
      studentId,
      setupEmailSent: shouldSendPasswordSetup && !warning,
      warning
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
};

export const updateStagiaire = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { fullName, phone, education, skills, experience } = req.body;

    const supervisor = await getSupervisor(req.user.id);
    if (!supervisor) {
      return res.status(403).json({ error: "Not authorized as supervisor" });
    }

    const current = await query(
      `SELECT s.*
       FROM students s
       WHERE s.id = $1 AND s.created_by_supervisor_id = $2`,
      [studentId, supervisor.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const curr = current.rows[0];
    const nextProfile = {
      full_name: fullName !== undefined ? fullName || null : curr.full_name,
      phone: phone !== undefined ? phone || null : curr.phone,
      education: education !== undefined ? education || null : curr.education,
      skills: skills !== undefined ? normalizeSkills(skills) : curr.skills,
      experience: experience !== undefined ? experience || null : curr.experience,
      cv_url: req.file ? `/uploads/${req.file.filename}` : curr.cv_url
    };

    const updated = await query(
      `UPDATE students
       SET full_name = $1,
           phone = $2,
           education = $3,
           skills = $4,
           experience = $5,
           cv_url = $6,
           profile_completed = $7,
           updated_at = NOW()
       WHERE id = $8 AND created_by_supervisor_id = $9
       RETURNING id, full_name, phone, education, skills, experience, cv_url, profile_completed, updated_at`,
      [
        nextProfile.full_name,
        nextProfile.phone,
        nextProfile.education,
        nextProfile.skills,
        nextProfile.experience,
        nextProfile.cv_url,
        computeProfileCompleted(nextProfile),
        studentId,
        supervisor.id
      ]
    );

    return res.json(updated.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const acceptStudent = async (req, res, next) => {
  try {
    const { internId, projectId } = req.body;
    if (!internId) {
      return res.status(400).json({ error: "internId required" });
    }

    const supervisor = await getSupervisor(req.user.id);
    if (!supervisor) {
      return res.status(403).json({ error: "Not authorized as supervisor" });
    }

    const intern = await query(
      `SELECT i.id, i.student_id, i.project_id, s.user_id
       FROM interns i
       JOIN students s ON s.id = i.student_id
       WHERE i.id = $1 AND i.supervisor_id = $2`,
      [internId, supervisor.id]
    );

    if (intern.rows.length === 0) {
      return res.status(404).json({ error: "Intern not found" });
    }

    let finalProjectId = intern.rows[0].project_id;
    if (projectId) {
      const project = await query(
        `SELECT id
         FROM projects
         WHERE id = $1 AND supervisor_id = $2`,
        [projectId, supervisor.id]
      );

      if (project.rows.length === 0) {
        return res.status(404).json({ error: "Project not found" });
      }

      finalProjectId = projectId;
      await query("UPDATE interns SET project_id = $1 WHERE id = $2", [projectId, internId]);
    }

    const tasks = await query(
      `SELECT title
       FROM tasks
       WHERE project_id = $1
       ORDER BY created_at`,
      [finalProjectId]
    );

    const projectInfo = await query(
      `SELECT title, description
       FROM projects
       WHERE id = $1`,
      [finalProjectId]
    );

    await query(
      `INSERT INTO notifications (user_id, type, message, is_read)
       VALUES ($1, 'acceptance', $2, false)`,
      [
        intern.rows[0].user_id,
        buildProjectNotificationText(
          projectInfo.rows[0]?.title || "StageFlow Project",
          projectInfo.rows[0]?.description || null,
          tasks.rows.map((task) => task.title).filter(Boolean)
        )
      ]
    );

    return res.json({ success: true, message: "Student accepted" });
  } catch (error) {
    return next(error);
  }
};

export const deleteInternFromProject = async (req, res, next) => {
  try {
    const { projectId, internId } = req.params;

    const supervisor = await getSupervisor(req.user.id);
    if (!supervisor) {
      return res.status(403).json({ error: "Not authorized as supervisor" });
    }

    const deleted = await query(
      `DELETE FROM interns i
       USING projects p
       WHERE i.id = $1
         AND i.project_id = p.id
         AND p.id = $2
         AND i.supervisor_id = $3
       RETURNING i.id`,
      [internId, projectId, supervisor.id]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const n8nCvParsedWebhook = async (req, res, next) => {
  try {
    const configuredSecret = process.env.N8N_WEBHOOK_SECRET;
    const incomingSecret = req.headers["x-webhook-token"];

    if (configuredSecret && incomingSecret !== configuredSecret) {
      return res.status(401).json({ error: "Invalid webhook token" });
    }

    const { studentId, email, cv_file_url: cvFileUrl, cvUrl } = req.body;
    if (!studentId && !email) {
      return res.status(400).json({ error: "studentId or email required" });
    }

    const resolvedUrl = cvFileUrl || cvUrl || null;
    if (!resolvedUrl) {
      return res.json({
        success: true,
        message: "CV parsing payload received. Simplified schema does not persist parsed metadata."
      });
    }

    let result;
    if (studentId) {
      result = await query(
        `UPDATE students
         SET cv_url = COALESCE($1, cv_url),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id`,
        [resolvedUrl, studentId]
      );
    } else {
      result = await query(
        `UPDATE students s
         SET cv_url = COALESCE($1, s.cv_url),
             updated_at = NOW()
         FROM users u
         WHERE s.user_id = u.id
           AND lower(u.email) = lower($2)
         RETURNING s.id`,
        [resolvedUrl, email]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.json({
      success: true,
      studentId: result.rows[0].id,
      message: "CV link updated. Simplified schema does not persist parsed metadata."
    });
  } catch (error) {
    return next(error);
  }
};
