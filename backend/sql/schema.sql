-- Stage / stagiaire platform schema (no internship offers: projects belong to supervisors only).
-- Apply migrations through `007_remove_internships.sql` on existing databases.
-- Features: Multi-interns per project, Task updates tracking, No companies table

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ================= DROP TABLES (in correct order) =================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS feedbacks CASCADE;
DROP TABLE IF EXISTS task_remarks CASCADE;
DROP TABLE IF EXISTS task_updates CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS interns CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS internships CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS supervisors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS email_verification_tokens CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- ================= CORE TABLES =================

-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','supervisor','admin')),
  is_active BOOLEAN DEFAULT TRUE,
  is_email_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(), -- it captures where the event especially happen
  updated_at TIMESTAMP DEFAULT NOW()
);

-- EMAIL VERIFICATION TOKENS TABLE
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PASSWORD RESET TOKENS TABLE
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- SUPERVISORS TABLE (with company fields integrated)
CREATE TABLE supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Company information (moved from companies table)
  company_name VARCHAR(180) NOT NULL,
  company_description TEXT,
  company_location VARCHAR(140),
  company_website VARCHAR(255),
  
  -- Supervisor information
  full_name VARCHAR(140) NOT NULL,
  position VARCHAR(140),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- STUDENTS TABLE
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Who created this student
  created_by_supervisor_id UUID NOT NULL REFERENCES supervisors(id) ON DELETE RESTRICT,
  
  full_name VARCHAR(140),
  phone VARCHAR(40),
  education TEXT,
  skills TEXT DEFAULT '',
  experience TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  cv_url TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================= PROJECTS (supervisor-owned) =================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,

  title VARCHAR(180) NOT NULL,
  description TEXT,
  objectives TEXT,
  location VARCHAR(140),
  duration VARCHAR(80),
  domain VARCHAR(120),
  requirements TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- INTERNS TABLE (Multi-interns per project association)
CREATE TABLE interns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
  
  status VARCHAR(30) DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','terminated')),
  
  start_date DATE,
  end_date DATE CHECK (end_date >= start_date),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(student_id, project_id)
);

-- ================= TASK MANAGEMENT =================

-- TASKS TABLE
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  deadline DATE,
  status VARCHAR(20) DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- TASK UPDATES TABLE (Task progress tracking by interns)
CREATE TABLE task_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  intern_id UUID NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  
  progress TEXT,
  status VARCHAR(20)
    CHECK (status IN ('todo','in_progress','done')),
  
  file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- TASK REMARKS TABLE (Supervisor feedback on tasks)
CREATE TABLE task_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================= EVALUATION & REPORTING =================

-- FEEDBACKS TABLE
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intern_id UUID NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  
  comment TEXT,
  rating NUMERIC(3,2) CHECK (rating BETWEEN 0 AND 5),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- REPORTS TABLE
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_id UUID NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','validated','rejected')),
  
  feedback TEXT,
  submitted_at TIMESTAMP,
  validated_at TIMESTAMP,
  validated_by_supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ================= COMMUNICATION & DOCUMENTS =================

-- DOCUMENTS TABLE
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- MESSAGES TABLE
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOGS TABLE
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ================= PERFORMANCE INDEXES =================

-- Users indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Email verification tokens indexes
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Password reset tokens indexes
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Supervisors indexes
CREATE INDEX idx_supervisors_user_id ON supervisors(user_id);
CREATE INDEX idx_supervisors_company_name ON supervisors(company_name);

-- Students indexes
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_created_by ON students(created_by_supervisor_id);

-- Projects indexes
CREATE INDEX idx_projects_supervisor_id ON projects(supervisor_id);

-- Interns indexes (Multi-interns per project)
CREATE INDEX idx_interns_student_id ON interns(student_id);
CREATE INDEX idx_interns_project_id ON interns(project_id);
CREATE INDEX idx_interns_supervisor_id ON interns(supervisor_id);
CREATE INDEX idx_interns_status ON interns(status);
-- Important: Index for finding all interns in a project
CREATE INDEX idx_interns_project_status ON interns(project_id, status);

-- Tasks indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);

-- Task updates indexes (Task progress tracking)
CREATE INDEX idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX idx_task_updates_intern_id ON task_updates(intern_id);
-- Important: Index for finding all updates by an intern
CREATE INDEX idx_task_updates_intern_task ON task_updates(intern_id, task_id);

-- Task remarks indexes
CREATE INDEX idx_task_remarks_task_id ON task_remarks(task_id);
CREATE INDEX idx_task_remarks_supervisor_id ON task_remarks(supervisor_id);

-- Feedbacks indexes
CREATE INDEX idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX idx_feedbacks_intern_id ON feedbacks(intern_id);

-- Reports indexes
CREATE INDEX idx_reports_intern_id ON reports(intern_id);
CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_reports_status ON reports(status);

-- Documents indexes
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_type ON documents(type);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Messages indexes
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ================= TRIGGERS FOR UPDATED_AT =================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql'; --tells postgresql that " the code of funciton is written (Procedural Language/PostgreSQL)"

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON supervisors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interns_updated_at BEFORE UPDATE ON interns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_updates_updated_at BEFORE UPDATE ON task_updates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_remarks_updated_at BEFORE UPDATE ON task_remarks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();