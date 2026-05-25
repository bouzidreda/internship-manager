import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import PageLayout from "../components/PageLayout";
import StatusBadge from "../components/StatusBadge";
import TaskModal from "../components/tasks/TaskModal";
import { Alert, Button, Card, StatCard } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../hooks/useAuth";

const STATUS_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "todo", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Terminées" }
];

const STATUS_OPTIONS = [
  { value: "todo", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Terminée" }
];

const emptyTaskForm = { title: "", description: "", projectId: "", deadline: "" };

const TasksPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalTask, setModalTask] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [createForm, setCreateForm] = useState(emptyTaskForm);
  const [editForm, setEditForm] = useState({ title: "", description: "", deadline: "" });
  const [progressForm, setProgressForm] = useState({ status: "todo", progress: "", fileUrl: "" });
  const [remarkContent, setRemarkContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isSupervisor = user?.role === "supervisor";
  const isStudent = user?.role === "student";

  const taskCounts = useMemo(
    () =>
      tasks.reduce(
        (acc, task) => {
          acc.total += 1;
          if (task.status === "todo") acc.todo += 1;
          if (task.status === "in_progress") acc.inProgress += 1;
          if (task.status === "done") acc.done += 1;
          return acc;
        },
        { total: 0, todo: 0, inProgress: 0, done: 0 }
      ),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [tasks, statusFilter]);

  const loadRemarks = async (taskId) => {
    try {
      const { data } = await apiClient.get(`/tasks/${taskId}/remarks`);
      setRemarks(Array.isArray(data) ? data : []);
    } catch {
      setRemarks([]);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [tasksRes, projectsRes] = await Promise.all([
        apiClient.get("/tasks"),
        isSupervisor ? apiClient.get("/projects") : Promise.resolve({ data: [] })
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    } catch (err) {
      setError(
        err.response?.status === 401
          ? "Votre session a expiré. Veuillez vous reconnecter."
          : err.response?.data?.message || "Impossible de charger les tâches."
      );
    } finally {
      setLoading(false);
    }
  }, [isSupervisor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const taskIdParam = searchParams.get("taskId");
    if (!taskIdParam || tasks.length === 0) return;

    const task = tasks.find((t) => t.id === taskIdParam);
    if (!task) {
      setError("Tâche introuvable.");
      return;
    }

    if (modalTask?.id !== task.id) {
      setModalTask(task);
      setProgressForm({ status: task.status, progress: "", fileUrl: "" });
      loadRemarks(task.id);
    }

    const notificationId = searchParams.get("notificationId");
    if (notificationId) {
      apiClient.patch(`/workflow/notifications/${notificationId}/read`).catch(() => {});
    }
  }, [searchParams, tasks, modalTask?.id]);

  const openTaskModal = (task) => {
    setModalTask(task);
    setEditMode(false);
    setProgressForm({ status: task.status, progress: "", fileUrl: "" });
    setRemarkContent("");
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set("taskId", task.id);
      return next;
    });
    loadRemarks(task.id);
  };

  const closeTaskModal = () => {
    setModalTask(null);
    setEditMode(false);
    setRemarks([]);
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("taskId");
      next.delete("notificationId");
      return next;
    });
  };

  const refreshTasks = async (keepTaskId) => {
    const { data } = await apiClient.get("/tasks");
    const taskList = Array.isArray(data) ? data : [];
    setTasks(taskList);
    if (keepTaskId) {
      const updated = taskList.find((t) => t.id === keepTaskId);
      if (updated) {
        setModalTask(updated);
        setProgressForm((prev) => ({ ...prev, status: updated.status }));
      }
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      await apiClient.post("/tasks", {
        title: createForm.title.trim(),
        description: createForm.description.trim() || "",
        projectId: createForm.projectId,
        deadline: createForm.deadline || null
      });
      setCreateForm(emptyTaskForm);
      setCreateOpen(false);
      showToast("Tâche créée avec succès.", "success");
      await loadData();
    } catch (err) {
      const message = err.response?.data?.message || "Création impossible.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (event) => {
    event.preventDefault();
    if (!modalTask) return;
    try {
      setSaving(true);
      await apiClient.patch(`/tasks/${modalTask.id}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || "",
        deadline: editForm.deadline || null
      });
      setEditMode(false);
      showToast("Tâche mise à jour.", "success");
      await refreshTasks(modalTask.id);
    } catch (err) {
      const message = err.response?.data?.message || "Modification impossible.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStudentSave = async (event) => {
    event.preventDefault();
    if (!modalTask) return;
    try {
      setSaving(true);
      await apiClient.post(`/students/tasks/${modalTask.id}/updates`, {
        status: progressForm.status,
        progress: progressForm.progress.trim() || null,
        fileUrl: progressForm.fileUrl.trim() || null
      });
      showToast("Progression enregistrée.", "success");
      setProgressForm((prev) => ({ ...prev, progress: "", fileUrl: "" }));
      await refreshTasks(modalTask.id);
    } catch (err) {
      const message = err.response?.data?.message || "Mise à jour impossible.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemarkSubmit = async (event) => {
    event.preventDefault();
    if (!modalTask || !remarkContent.trim()) return;
    try {
      setSaving(true);
      await apiClient.post(`/tasks/${modalTask.id}/remarks`, { content: remarkContent.trim() });
      setRemarkContent("");
      showToast("Commentaire ajouté.", "success");
      await loadRemarks(modalTask.id);
      await refreshTasks(modalTask.id);
    } catch (err) {
      const message = err.response?.data?.message || "Commentaire impossible.";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await apiClient.delete(`/tasks/${deleteTarget.id}`);
      if (modalTask?.id === deleteTarget.id) closeTaskModal();
      showToast("Tâche supprimée.", "success");
      await loadData();
    } catch (err) {
      showToast(err.response?.data?.message || "Suppression impossible.", "error");
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const startEdit = () => {
    if (!modalTask) return;
    setEditForm({
      title: modalTask.title,
      description: modalTask.description || "",
      deadline: modalTask.deadline ? modalTask.deadline.slice(0, 10) : ""
    });
    setEditMode(true);
  };

  if (loading) return <LoadingSpinner label="Chargement des tâches…" />;

  return (
    <PageLayout
      title={isStudent ? "Mes tâches" : "Gestion des tâches"}
      subtitle="Créez, suivez et mettez à jour les tâches de vos projets de stage."
      containerClassName="tasks-page-v2"
      actions={
        isSupervisor ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Nouvelle tâche
          </Button>
        ) : null
      }
    >
      {error && <Alert variant="error">{error}</Alert>}

      <div className="dashboard-grid ds-stat-grid">
        <StatCard label="Total" value={taskCounts.total} icon="☑" />
        <StatCard label="À faire" value={taskCounts.todo} icon="□" />
        <StatCard label="En cours" value={taskCounts.inProgress} icon="◎" />
        <StatCard label="Terminées" value={taskCounts.done} icon="✓" />
      </div>

      <Card title="Liste des tâches">
        <div className="tasks-toolbar">
          <div className="tasks-filter-tabs" role="tablist" aria-label="Filtrer par statut">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === filter.value}
                className={`tasks-filter-tab ${statusFilter === filter.value ? "is-active" : ""}`}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <span className="ds-toolbar__meta">
            {filteredTasks.length} tâche{filteredTasks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <EmptyState
            icon="☑"
            title="Aucune tâche"
            description={
              isSupervisor
                ? "Créez une tâche pour commencer le suivi de votre équipe."
                : "Vos tâches apparaîtront ici dès qu'un superviseur vous en assignera."
            }
            action={
              isSupervisor ? (
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  Créer une tâche
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap tasks-table-card">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Projet</th>
                  <th>Statut</th>
                  <th>Échéance</th>
                  <th>Commentaires</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`tasks-row ${modalTask?.id === task.id ? "is-selected" : ""}`}
                    tabIndex={0}
                    onClick={() => openTaskModal(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openTaskModal(task);
                      }
                    }}
                  >
                    <td>
                      <strong>{task.title}</strong>
                      {task.description && <div className="muted-cell">{task.description}</div>}
                    </td>
                    <td>{task.project_title || "—"}</td>
                    <td>
                      <StatusBadge status={task.status} />
                    </td>
                    <td>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td>{task.remark_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create task modal (supervisor) */}
      {createOpen && (
        <div className="tasks-modal-overlay" role="presentation" onClick={() => setCreateOpen(false)}>
          <div
            className="tasks-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-task-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="tasks-modal__header">
              <h2 id="create-task-title" className="tasks-modal__title">
                Nouvelle tâche
              </h2>
              <button
                type="button"
                className="ds-dialog__icon-close"
                onClick={() => setCreateOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </header>
            <form className="tasks-form-grid" onSubmit={handleCreate}>
              <label>
                Titre
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  placeholder="Titre de la tâche"
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Instructions et contexte"
                />
              </label>
              <label>
                Projet
                <select
                  value={createForm.projectId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, projectId: e.target.value }))}
                  required
                >
                  <option value="">Choisir un projet</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Échéance
                <input
                  type="date"
                  value={createForm.deadline}
                  onChange={(e) => setCreateForm((p) => ({ ...p, deadline: e.target.value }))}
                />
              </label>
              <footer className="tasks-modal__footer">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Création…" : "Créer"}
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Task detail modal */}
      <TaskModal
        open={Boolean(modalTask)}
        task={modalTask}
        onClose={closeTaskModal}
        footer={
          isSupervisor && modalTask && !editMode ? (
            <>
              <Button type="button" variant="secondary" onClick={startEdit}>
                Modifier
              </Button>
              <Button type="button" variant="danger" onClick={() => setDeleteTarget(modalTask)}>
                Supprimer
              </Button>
              <Button type="button" variant="secondary" onClick={closeTaskModal}>
                Fermer
              </Button>
            </>
          ) : isStudent && modalTask ? (
            <>
              <Button type="button" variant="secondary" onClick={closeTaskModal}>
                Fermer
              </Button>
              <Button type="submit" form="student-task-form" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={closeTaskModal}>
              Fermer
            </Button>
          )
        }
      >
        {modalTask && editMode && isSupervisor && (
          <form className="tasks-form-grid tasks-modal__section" onSubmit={handleEditSave}>
            <h4>Modifier la tâche</h4>
            <label>
              Titre
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <label>
              Échéance
              <input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </label>
            <div className="tasks-modal__footer" style={{ paddingTop: 0 }}>
              <Button type="button" variant="secondary" onClick={() => setEditMode(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                Enregistrer
              </Button>
            </div>
          </form>
        )}

        {modalTask && isStudent && !editMode && (
          <form
            id="student-task-form"
            className="tasks-form-grid tasks-modal__section"
            onSubmit={handleStudentSave}
          >
            <h4>Mettre à jour la tâche</h4>
            <label>
              Statut
              <select
                value={progressForm.status}
                onChange={(e) => setProgressForm((p) => ({ ...p, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Détails de progression
              <textarea
                rows={4}
                placeholder="Décrivez votre avancement, difficultés rencontrées, prochaines étapes…"
                value={progressForm.progress}
                onChange={(e) => setProgressForm((p) => ({ ...p, progress: e.target.value }))}
              />
            </label>
            <label>
              Lien du livrable (optionnel)
              <input
                type="url"
                placeholder="https://…"
                value={progressForm.fileUrl}
                onChange={(e) => setProgressForm((p) => ({ ...p, fileUrl: e.target.value }))}
              />
            </label>
          </form>
        )}

        {modalTask && isSupervisor && !editMode && (
          <div className="tasks-modal__section">
            <h4>Commentaires ({remarks.length})</h4>
            <form className="tasks-form-grid" onSubmit={handleRemarkSubmit}>
              <label>
                Ajouter un commentaire
                <textarea
                  rows={3}
                  value={remarkContent}
                  onChange={(e) => setRemarkContent(e.target.value)}
                  placeholder="Feedback pour le stagiaire…"
                  required
                />
              </label>
              <Button type="submit" size="sm" disabled={saving || !remarkContent.trim()}>
                Publier
              </Button>
            </form>
            <div className="tasks-remarks">
              {remarks.length === 0 ? (
                <p className="muted-cell">Aucun commentaire pour le moment.</p>
              ) : (
                remarks.map((remark) => (
                  <div key={remark.id} className="tasks-remark">
                    <strong>{remark.author_name || remark.email || "Superviseur"}</strong>
                    <small>
                      {new Date(remark.created_at).toLocaleString("fr-FR")}
                    </small>
                    <p>{remark.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {modalTask && isStudent && !editMode && remarks.length > 0 && (
          <div className="tasks-modal__section">
            <h4>Commentaires du superviseur ({remarks.length})</h4>
            <div className="tasks-remarks">
              {remarks.map((remark) => (
                <div key={remark.id} className="tasks-remark">
                  <strong>{remark.author_name || "Superviseur"}</strong>
                  <small>{new Date(remark.created_at).toLocaleString("fr-FR")}</small>
                  <p>{remark.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </TaskModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Supprimer la tâche ?"
        message={`La tâche « ${deleteTarget?.title} » sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </PageLayout>
  );
};

export default TasksPage;
