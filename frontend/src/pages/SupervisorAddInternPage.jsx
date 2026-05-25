import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "../components/PageLayout";
import EmptyState from "../components/EmptyState";
import { Alert } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";

const emptyForm = {
  email: "",
  fullName: "",
  phone: "",
  education: "",
  skills: "",
  experience: ""
};

const editableFields = ["fullName", "phone", "education", "skills", "experience"];

const getStudentName = (student) => student?.full_name || student?.email || "Stagiaire";

const getInitials = (student) =>
  getStudentName(student)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const getStudentStatus = (student) => {
  if (student.assignment_status === "active") return { label: "Affecte", className: "active" };
  if (student.assignment_status === "paused") return { label: "En pause", className: "paused" };
  if (!student.is_email_verified) return { label: "Invitation envoyee", className: "pending" };
  return { label: "En attente", className: "pending" };
};

const toForm = (student) => ({
  email: student.email || "",
  fullName: student.full_name || "",
  phone: student.phone || "",
  education: student.education || "",
  skills: student.skills || "",
  experience: student.experience || ""
});

const SupervisorAddInternPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [editCvFile, setEditCvFile] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [createForm, setCreateForm] = useState(emptyForm);

  const stats = useMemo(
    () => ({
      total: students.length,
      pending: students.filter((student) => !student.assignment_status).length,
      assigned: students.filter((student) => student.assignment_status).length
    }),
    [students]
  );

  const loadStudents = useCallback(async () => {
    if (user?.role !== "supervisor") return;

    try {
      setLoadingStudents(true);
      const { data } = await apiClient.get("/supervisors/students");
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Impossible de charger les stagiaires");
    } finally {
      setLoadingStudents(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (!editableFields.includes(name)) return;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateCvFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Veuillez telecharger un fichier PDF ou Word (.doc, .docx)");
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("La taille du fichier ne doit pas depasser 5MB");
      return false;
    }

    setError("");
    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validateCvFile(file)) {
      setCvFile(file);
    }
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validateCvFile(file)) {
      setEditCvFile(file);
    }
  };

  const openStudentDetails = (student) => {
    setSelectedStudent(student);
    setEditForm(toForm(student));
    setEditCvFile(null);
    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  const closeStudentDetails = () => {
    setSelectedStudent(null);
    setIsEditing(false);
    setEditCvFile(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (user?.role !== "supervisor") {
      return;
    }
    if (!createForm.email?.trim()) {
      setError("L'email est requis");
      return;
    }
    if (!cvFile) {
      setError("Le CV du stagiaire est obligatoire");
      return;
    }

    try {
      setSubmittingCreate(true);
      setError("");
      setSuccess("");

      const fd = new FormData();
      fd.append("email", createForm.email.trim());
      fd.append("fullName", createForm.fullName.trim());
      fd.append("phone", createForm.phone || "");
      fd.append("education", createForm.education || "");
      fd.append("skills", createForm.skills || "");
      fd.append("experience", createForm.experience || "");
      fd.append("cv", cvFile);

      const { data } = await apiClient.post("/workflow/supervisors/students", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const emailNote = data?.setupEmailSent
        ? " Un email de configuration du mot de passe a ete envoye au stagiaire."
        : data?.warning
          ? " Le profil est cree, mais l'email de configuration n'a pas pu etre envoye."
          : "";

      setSuccess(`Stagiaire cree. Il apparait dans la liste ci-dessus.${emailNote}`);
      setCreateForm(emptyForm);
      setCvFile(null);
      await loadStudents();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Echec de la creation");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    try {
      setSavingStudent(true);
      setError("");
      setSuccess("");

      const fd = new FormData();
      editableFields.forEach((field) => fd.append(field, editForm[field] || ""));
      if (editCvFile) {
        fd.append("cv", editCvFile);
      }

      await apiClient.put(`/workflow/supervisors/students/${selectedStudent.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setSuccess("Informations du stagiaire mises a jour.");
      setIsEditing(false);
      setEditCvFile(null);
      await loadStudents();
      const refreshed = await apiClient.get("/supervisors/students");
      const nextSelected = (refreshed.data || []).find((student) => student.id === selectedStudent.id);
      if (nextSelected) {
        setSelectedStudent(nextSelected);
        setEditForm(toForm(nextSelected));
        setStudents(refreshed.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Echec de la mise a jour");
    } finally {
      setSavingStudent(false);
    }
  };

  return (
    <PageLayout
      className="add-intern-page"
      title="Ajouter un stagiaire"
      subtitle="Creez un profil stagiaire, consultez les informations existantes et modifiez uniquement les donnees de profil."
    >
      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <section className="form-section card intern-list-section">
        <div className="intern-list-header">
          <div>
            <h3>Stagiaires suivis</h3>
            <p className="muted-cell">Liste des stagiaires crees par votre compte superviseur.</p>
          </div>
          <div className="intern-list-stats" aria-label="Resume stagiaires">
            <span><strong>{stats.total}</strong> Total</span>
            <span><strong>{stats.pending}</strong> En attente</span>
            <span><strong>{stats.assigned}</strong> Affectes</span>
          </div>
        </div>

        {loadingStudents ? (
          <p className="muted-cell">Chargement des stagiaires...</p>
        ) : students.length === 0 ? (
          <EmptyState title="Aucun stagiaire" description="Les stagiaires ajoutes apparaitront ici avant le formulaire." />
        ) : (
          <div className="intern-list">
            {students.map((student) => {
              const status = getStudentStatus(student);
              return (
                <article key={student.id} className="intern-list-item">
                  <div className="student-avatar" aria-hidden="true">{getInitials(student)}</div>
                  <div className="intern-list-main">
                    <div className="intern-list-title-row">
                      <h4>{getStudentName(student)}</h4>
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="student-email">{student.email}</p>
                    <div className="intern-list-meta">
                      <span>{student.education || "Formation non renseignee"}</span>
                      <span>{student.assigned_project_title || "Sans projet actif"}</span>
                      <span>{student.profile_completed ? "Profil complet" : "Profil incomplet"}</span>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary intern-list-action" onClick={() => openStudentDetails(student)}>
                    Consulter
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="form-section card">
        <h3>Creer un stagiaire (profil en attente)</h3>
        <form onSubmit={handleCreateSubmit} className="add-intern-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input type="email" id="email" name="email" value={createForm.email} onChange={handleCreateChange} required className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="fullName">Nom complet</label>
              <input type="text" id="fullName" name="fullName" value={createForm.fullName} onChange={handleCreateChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Telephone</label>
              <input type="tel" id="phone" name="phone" value={createForm.phone} onChange={handleCreateChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="education">Formation</label>
              <input type="text" id="education" name="education" value={createForm.education} onChange={handleCreateChange} className="form-input" />
            </div>
            <div className="form-group full-width">
              <label htmlFor="skills">Competences</label>
              <input type="text" id="skills" name="skills" value={createForm.skills} onChange={handleCreateChange} className="form-input" />
            </div>
            <div className="form-group full-width">
              <label htmlFor="experience">Experience</label>
              <textarea id="experience" name="experience" value={createForm.experience} onChange={handleCreateChange} rows={3} className="form-textarea" />
            </div>
            <div className="form-group full-width">
              <label htmlFor="cv">CV * (PDF ou Word, max 5 Mo)</label>
              <input type="file" id="cv" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="form-file" />
              {cvFile && <p className="muted-cell">{cvFile.name}</p>}
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={submittingCreate}>
            {submittingCreate ? "Creation..." : "Creer le stagiaire"}
          </button>
        </form>
      </section>

      {selectedStudent && (
        <div className="ds-dialog-overlay" role="presentation" onClick={closeStudentDetails}>
          <div className="ds-dialog ds-dialog--wide intern-details-dialog" role="dialog" aria-modal="true" aria-labelledby="intern-details-title" onClick={(e) => e.stopPropagation()}>
            <header className="ds-dialog__header ds-dialog__header--row">
              <div>
                <h3 id="intern-details-title">{getStudentName(selectedStudent)}</h3>
                <p className="muted-cell">{selectedStudent.email}</p>
              </div>
              <button type="button" className="ds-dialog__icon-close" onClick={closeStudentDetails} aria-label="Fermer">x</button>
            </header>

            <form onSubmit={handleUpdateSubmit} className="ds-dialog__body add-intern-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="edit-email">Email</label>
                  <input id="edit-email" value={editForm.email} readOnly className="form-input readonly-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-status">Statut</label>
                  <input id="edit-status" value={getStudentStatus(selectedStudent).label} readOnly className="form-input readonly-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-fullName">Nom complet</label>
                  <input id="edit-fullName" name="fullName" value={editForm.fullName} onChange={handleEditChange} readOnly={!isEditing} className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-phone">Telephone</label>
                  <input id="edit-phone" name="phone" value={editForm.phone} onChange={handleEditChange} readOnly={!isEditing} className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-education">Formation</label>
                  <input id="edit-education" name="education" value={editForm.education} onChange={handleEditChange} readOnly={!isEditing} className="form-input" />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-project">Projet actuel</label>
                  <input id="edit-project" value={selectedStudent.assigned_project_title || "Sans projet actif"} readOnly className="form-input readonly-input" />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="edit-skills">Competences</label>
                  <input id="edit-skills" name="skills" value={editForm.skills} onChange={handleEditChange} readOnly={!isEditing} className="form-input" />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="edit-experience">Experience</label>
                  <textarea id="edit-experience" name="experience" value={editForm.experience} onChange={handleEditChange} readOnly={!isEditing} rows={3} className="form-textarea" />
                </div>
                {isEditing && (
                  <div className="form-group full-width">
                    <label htmlFor="edit-cv">Remplacer le CV</label>
                    <input type="file" id="edit-cv" accept=".pdf,.doc,.docx" onChange={handleEditFileChange} className="form-file" />
                    {editCvFile && <p className="muted-cell">{editCvFile.name}</p>}
                  </div>
                )}
              </div>

              <footer className="ds-dialog__footer">
                {isEditing ? (
                  <>
                    <button type="button" className="btn-secondary" onClick={() => { setIsEditing(false); setEditForm(toForm(selectedStudent)); setEditCvFile(null); }}>
                      Annuler
                    </button>
                    <button type="submit" className="btn-primary" disabled={savingStudent}>
                      {savingStudent ? "Enregistrement..." : "Enregistrer"}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-secondary" onClick={closeStudentDetails}>Fermer</button>
                    <button type="button" className="btn-primary" onClick={() => setIsEditing(true)}>Modifier les infos</button>
                  </>
                )}
              </footer>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default SupervisorAddInternPage;
