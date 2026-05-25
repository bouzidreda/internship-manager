import { useEffect, useRef, useState } from "react";
import apiClient from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { Alert, Button, Card } from "../ui";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const StudentPdfReportForm = ({ onSubmitted }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [interns, setInterns] = useState([]);
  const [loadingInterns, setLoadingInterns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [internId, setInternId] = useState("");
  const [pdfFile, setPdfFile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingInterns(true);
        const { data } = await apiClient.get("/students/progress");
        const unique = new Map();
        (Array.isArray(data) ? data : []).forEach((item) => {
          if (item.intern_id && !unique.has(item.intern_id)) {
            unique.set(item.intern_id, item);
          }
        });
        setInterns(Array.from(unique.values()));
      } catch {
        setInterns([]);
      } finally {
        setLoadingInterns(false);
      }
    };
    load();
  }, []);

  const validatePdf = (file) => {
    if (!file) return "Veuillez sélectionner un fichier PDF.";
    if (file.type !== "application/pdf") return "Seuls les fichiers PDF sont acceptés.";
    if (!file.name.toLowerCase().endsWith(".pdf")) return "L'extension du fichier doit être .pdf";
    if (file.size > MAX_PDF_BYTES) return "Le fichier ne doit pas dépasser 10 Mo.";
    return "";
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    const validation = validatePdf(file);
    if (validation) {
      setError(validation);
      setPdfFile(null);
      return;
    }
    setError("");
    setPdfFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!title.trim() || title.trim().length < 3) {
      setError("Le titre doit contenir au moins 3 caractères.");
      return;
    }
    if (!internId) {
      setError("Veuillez sélectionner un stage.");
      return;
    }
    const fileValidation = validatePdf(pdfFile);
    if (fileValidation) {
      setError(fileValidation);
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("internId", internId);
      formData.append("pdf", pdfFile);

      const { data } = await apiClient.post("/reports/pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const selectedIntern = interns.find((intern) => String(intern.intern_id) === String(internId));

      setTitle("");
      setInternId("");
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast("Rapport PDF soumis avec succès.", "success");
      onSubmitted?.({
        ...data,
        project_title: selectedIntern?.project_title || data.project_title,
        company_name: selectedIntern?.company_name || data.company_name,
        intern_status: selectedIntern?.intern_status || data.intern_status,
        submitted_at: data.submitted_at || new Date().toISOString(),
        status: data.status || "submitted"
      });
    } catch (err) {
      const message = err.response?.data?.message || "Échec de l'envoi du rapport PDF.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title="Soumettre un rapport PDF"
      subtitle="Téléversez un document PDF avec un titre pour validation par votre superviseur."
      className="tasks-pdf-card"
    >
      {loadingInterns ? (
        <p className="muted-cell">Chargement des stages…</p>
      ) : interns.length === 0 ? (
        <p className="muted-cell">Aucun stage actif trouvé pour soumettre un rapport.</p>
      ) : (
        <form className="tasks-form-grid" onSubmit={handleSubmit}>
          {error && <Alert variant="error">{error}</Alert>}

          <label htmlFor="report-title">
            Titre du rapport
            <input
              id="report-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Rapport de mi-parcours"
              maxLength={180}
              required
            />
          </label>

          <label htmlFor="report-intern">
            Stage / projet
            <select
              id="report-intern"
              value={internId}
              onChange={(e) => setInternId(e.target.value)}
              required
            >
              <option value="">Sélectionner un stage</option>
              {interns.map((intern) => (
                <option key={intern.intern_id} value={intern.intern_id}>
                  {intern.project_title || "Projet"} — {intern.company_name || "Entreprise"}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="tasks-form-grid label" style={{ display: "block", marginBottom: "var(--space-2)" }}>
              Fichier PDF
            </span>
            <div className={`tasks-pdf-drop ${pdfFile ? "has-file" : ""}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileChange}
                aria-label="Sélectionner un fichier PDF"
                style={{ display: "none" }}
                id="report-pdf-input"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Choisir un PDF
              </Button>
              <p className="tasks-pdf-hint">PDF uniquement · 10 Mo maximum</p>
              {pdfFile && <p className="tasks-pdf-filename">{pdfFile.name}</p>}
            </div>
          </div>

          <div className="tasks-modal__footer" style={{ paddingTop: 0 }}>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Envoi en cours…" : "Soumettre le rapport"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};

export default StudentPdfReportForm;
