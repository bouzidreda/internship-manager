import fs from "fs";
import path from "path";
import { query } from "../../config/db.js";
import { logAudit } from "../../utils/audit.js";

const getStudentId = async (userId) => {
  const student = await query("SELECT id FROM students WHERE user_id = $1", [userId]);
  return student.rows[0]?.id || null;
};

const getSupervisorId = async (userId) => {
  const supervisor = await query("SELECT id FROM supervisors WHERE user_id = $1", [userId]);
  return supervisor.rows[0]?.id || null;
};

export const createReport = async (req, res, next) => {
  try {
    const { internId, title, content } = req.body;

    const studentId = await getStudentId(req.user.id);
    if (!studentId) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const intern = await query(
      `SELECT id, student_id, project_id
       FROM interns
       WHERE id = $1 AND student_id = $2`,
      [internId, studentId]
    );

    if (intern.rows.length === 0) {
      return res.status(403).json({ message: "Intern not found or not assigned to you" });
    }

    const result = await query(
      `INSERT INTO reports (intern_id, project_id, title, content, status)
       VALUES ($1, $2, $3, $4, 'draft')
       RETURNING *`,
      [internId, intern.rows[0].project_id, title, content]
    );

    await logAudit(req.user.id, "REPORT_CREATED", { reportId: result.rows[0].id });
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const createReportPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Un fichier PDF est requis." });
    }

    const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
    const internId = req.body.internId;

    if (!title || title.length < 3) {
      return res.status(400).json({ message: "Le titre doit contenir au moins 3 caractères." });
    }

    if (!internId) {
      return res.status(400).json({ message: "Le stage associé est requis." });
    }

    const studentId = await getStudentId(req.user.id);
    if (!studentId) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const intern = await query(
      `SELECT id, student_id, project_id
       FROM interns
       WHERE id = $1 AND student_id = $2`,
      [internId, studentId]
    );

    if (intern.rows.length === 0) {
      return res.status(403).json({ message: "Intern not found or not assigned to you" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const content = `Rapport PDF soumis : ${title}`;

    const result = await query(
      `INSERT INTO reports (intern_id, project_id, title, content, file_url, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, 'submitted', NOW())
       RETURNING *`,
      [internId, intern.rows[0].project_id, title, content, fileUrl]
    );

    await logAudit(req.user.id, "REPORT_PDF_SUBMITTED", { reportId: result.rows[0].id });
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const downloadReportPdf = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.id);
    const supervisorId = await getSupervisorId(req.user.id);

    let reportQuery;
    let values;

    if (studentId) {
      reportQuery = `SELECT r.file_url, r.title
        FROM reports r
        JOIN interns i ON i.id = r.intern_id
        WHERE r.id = $1 AND i.student_id = $2`;
      values = [req.params.id, studentId];
    } else if (supervisorId) {
      reportQuery = `SELECT r.file_url, r.title
        FROM reports r
        JOIN projects p ON p.id = r.project_id
        WHERE r.id = $1 AND p.supervisor_id = $2`;
      values = [req.params.id, supervisorId];
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const report = await query(reportQuery, values);
    if (report.rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    const fileUrl = report.rows[0].file_url;
    if (!fileUrl) {
      return res.status(404).json({ message: "Ce rapport ne contient pas de fichier PDF." });
    }

    const filename = String(fileUrl).replace("/uploads/", "");
    const filePath = path.resolve(process.cwd(), "uploads", filename);

    if (!filePath.startsWith(path.resolve(process.cwd(), "uploads")) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Fichier introuvable" });
    }

    return res.download(filePath, `${report.rows[0].title || "rapport"}.pdf`);
  } catch (error) {
    return next(error);
  }
};

export const submitReport = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.id);
    if (!studentId) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const report = await query(
      `SELECT r.id, r.status
       FROM reports r
       JOIN interns i ON i.id = r.intern_id
       WHERE r.id = $1 AND i.student_id = $2`,
      [req.params.id, studentId]
    );

    if (report.rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.rows[0].status !== "draft") {
      return res.status(400).json({ message: "Only draft reports can be submitted" });
    }

    const result = await query(
      `UPDATE reports
       SET status = 'submitted',
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    await logAudit(req.user.id, "REPORT_SUBMITTED", { reportId: req.params.id });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const listMyReports = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.id);
    if (!studentId) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const result = await query(
      `SELECT
         r.id,
         r.title,
         r.file_url,
         r.status,
         r.feedback,
         r.created_at,
         r.submitted_at,
         r.validated_at,
         i.id AS intern_id,
         i.status AS intern_status,
         p.title AS project_title,
         sup.company_name,
         sup.full_name AS supervisor_name
       FROM reports r
       JOIN interns i ON i.id = r.intern_id
       JOIN projects p ON p.id = r.project_id
       JOIN supervisors sup ON sup.id = p.supervisor_id
       WHERE i.student_id = $1
       ORDER BY r.created_at DESC`,
      [studentId]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};

export const getReportDetails = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.id);
    if (studentId) {
      const report = await query(
        `SELECT r.*
         FROM reports r
         JOIN interns i ON i.id = r.intern_id
         WHERE r.id = $1 AND i.student_id = $2`,
        [req.params.id, studentId]
      );

      if (report.rows.length === 0) {
        return res.status(404).json({ message: "Report not found" });
      }

      return res.json(report.rows[0]);
    }

    const supervisorId = await getSupervisorId(req.user.id);
    if (!supervisorId) {
      return res.status(404).json({ message: "Access denied" });
    }

    const report = await query(
      `SELECT r.*
       FROM reports r
       JOIN projects p ON p.id = r.project_id
       WHERE r.id = $1 AND p.supervisor_id = $2`,
      [req.params.id, supervisorId]
    );

    if (report.rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.json(report.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const updateReport = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.id);
    if (!studentId) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const report = await query(
      `SELECT r.id, r.status
       FROM reports r
       JOIN interns i ON i.id = r.intern_id
       WHERE r.id = $1 AND i.student_id = $2`,
      [req.params.id, studentId]
    );

    if (report.rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.rows[0].status !== "draft") {
      return res.status(400).json({ message: "Only draft reports can be edited" });
    }

    const result = await query(
      `UPDATE reports
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [req.body.title ?? null, req.body.content ?? null, req.params.id]
    );

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const validateReport = async (req, res, next) => {
  try {
    const supervisorId = await getSupervisorId(req.user.id);
    if (!supervisorId) {
      return res.status(404).json({ message: "Supervisor profile not found" });
    }

    const report = await query(
      `SELECT r.id, r.status
       FROM reports r
       JOIN projects p ON p.id = r.project_id
       WHERE r.id = $1 AND p.supervisor_id = $2`,
      [req.params.id, supervisorId]
    );

    if (report.rows.length === 0) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.rows[0].status !== "submitted") {
      return res.status(400).json({ message: "Only submitted reports can be validated" });
    }

    const result = await query(
      `UPDATE reports
       SET status = $1,
           validated_at = NOW(),
           feedback = $2,
           validated_by_supervisor_id = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [req.body.status, req.body.feedback || null, supervisorId, req.params.id]
    );

    await logAudit(req.user.id, "REPORT_VALIDATED", {
      reportId: req.params.id,
      status: req.body.status
    });

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

export const listReportsForValidation = async (req, res, next) => {
  try {
    const supervisorId = await getSupervisorId(req.user.id);
    if (!supervisorId) {
      return res.status(404).json({ message: "Supervisor profile not found" });
    }

    const result = await query(
      `SELECT
         r.id,
         r.title,
         r.file_url,
         r.status,
         r.feedback,
         r.created_at,
         r.submitted_at,
         r.validated_at,
         i.id AS intern_id,
         s.full_name AS student_name,
         p.title AS project_title
       FROM reports r
       JOIN interns i ON i.id = r.intern_id
       JOIN students s ON s.id = i.student_id
       JOIN projects p ON p.id = r.project_id
       WHERE p.supervisor_id = $1
         AND r.status = 'submitted'
       ORDER BY r.submitted_at DESC NULLS LAST, r.created_at DESC`,
      [supervisorId]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
};
