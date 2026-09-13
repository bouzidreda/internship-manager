import { useCallback, useEffect, useState } from "react";
import apiClient from "../api/client";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import PageLayout from "../components/PageLayout";
import StatusBadge from "../components/StatusBadge";
import StudentPdfReportForm from "../components/tasks/StudentPdfReportForm";
import { Alert, Button, Card } from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../hooks/useAuth";
import "../styles/reports-form.css";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("fr-FR") : "-");

const safePdfName = (title) => {
  const baseName = String(title || "rapport")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");

  return `${baseName || "rapport"}.pdf`;
};

const ReportsPageEnhanced = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null);

  const canValidate = user?.role === "supervisor";
  const isStudent = user?.role === "student";

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError("");
      const { data } = await apiClient.get(isStudent ? "/reports/my" : "/reports/validation/list");
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors du chargement des rapports.");
    } finally {
      setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => () => {
    if (preview?.url) {
      window.URL.revokeObjectURL(preview.url);
    }
  }, [preview?.url]);

  const getReportPdfBlob = async (report) => {
    const response = await apiClient.get(`/reports/${report.id}/pdf`, { responseType: "blob" });
    return response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: "application/pdf" });
  };

  const getBlobErrorMessage = async (err, fallback) => {
    const data = err.response?.data;
    if (data instanceof Blob && data.type?.includes("application/json")) {
      try {
        const payload = JSON.parse(await data.text());
        return payload.message || fallback;
      } catch {
        return fallback;
      }
    }

    return err.response?.data?.message || fallback;
  };

  const validateReport = async (reportId, status) => {
    const fallback = status === "validated" ? "Rapport valide." : "Rapport a revoir.";
    const feedback = window.prompt("Feedback", fallback);
    if (feedback === null) return;

    try {
      setBusyId(reportId);
      await apiClient.patch(`/reports/${reportId}/validate`, { status, feedback });
      showToast(status === "validated" ? "Rapport valide avec succes." : "Rapport rejete.", "success");
      await loadData();
    } catch (err) {
      const message = err.response?.data?.message || "Validation impossible.";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleReportSubmitted = (report) => {
    if (report?.id) {
      setReports((currentReports) => [
        report,
        ...currentReports.filter((currentReport) => currentReport.id !== report.id)
      ]);
    }

    loadData({ silent: true });
  };

  const previewPdf = async (report) => {
    try {
      setBusyId(report.id);
      const blob = await getReportPdfBlob(report);
      const url = window.URL.createObjectURL(blob);
      setPreview((currentPreview) => {
        if (currentPreview?.url) {
          window.URL.revokeObjectURL(currentPreview.url);
        }

        return {
          url,
          title: report.title || "Rapport PDF"
        };
      });
    } catch (err) {
      const message = await getBlobErrorMessage(err, "Apercu du PDF impossible.");
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (report) => {
    try {
      setBusyId(report.id);
      const blob = await getReportPdfBlob(report);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safePdfName(report.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const message = await getBlobErrorMessage(err, "Telechargement du PDF impossible.");
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const closePreview = () => {
    setPreview((currentPreview) => {
      if (currentPreview?.url) {
        window.URL.revokeObjectURL(currentPreview.url);
      }

      return null;
    });
  };

  if (loading) return <LoadingSpinner label="Chargement des rapports..." />;

  return (
    <PageLayout
      title={canValidate ? "Rapports a valider" : "Rapports"}
      subtitle={
        isStudent
          ? "Soumettez votre rapport de stage au format PDF et suivez son statut."
          : "Consultez les rapports PDF soumis par vos stagiaires et validez-les."
      }
      containerClassName="reports-page"
    >
      {error && <Alert variant="error">{error}</Alert>}

      {isStudent && <StudentPdfReportForm onSubmitted={handleReportSubmitted} />}

      <Card title={canValidate ? "File de validation" : "Historique des rapports"}>
        {reports.length === 0 ? (
          <EmptyState
            icon="▤"
            title="Aucun rapport"
            description={
              isStudent
                ? "Vos rapports PDF soumis apparaitront ici."
                : "Aucun rapport PDF n'est en attente de validation."
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  {canValidate && <th>Stagiaire</th>}
                  <th>Stage</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Feedback</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <strong>{report.title}</strong>
                      {report.file_url && <div className="muted-cell">PDF joint</div>}
                    </td>
                    {canValidate && <td>{report.student_name || "-"}</td>}
                    <td>{report.project_title || "-"}</td>
                    <td>
                      <StatusBadge status={report.status} />
                    </td>
                    <td>{formatDate(report.submitted_at || report.created_at)}</td>
                    <td>
                      <div className="report-feedback-cell">
                        <span>{report.feedback || "-"}</span>
                        {canValidate && report.file_url && (
                          <div className="report-feedback-actions" aria-label={`PDF de ${report.title}`}>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busyId === report.id}
                              onClick={() => previewPdf(report)}
                            >
                              Apercu
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busyId === report.id}
                              onClick={() => downloadPdf(report)}
                            >
                              PDF
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="inline-actions">
                        {isStudent && report.file_url && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={busyId === report.id}
                            onClick={() => downloadPdf(report)}
                          >
                            PDF
                          </Button>
                        )}
                        {canValidate && report.status === "submitted" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId === report.id}
                              onClick={() => validateReport(report.id, "validated")}
                            >
                              Valider
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              disabled={busyId === report.id}
                              onClick={() => validateReport(report.id, "rejected")}
                            >
                              Rejeter
                            </Button>
                          </>
                        )}
                        {!report.file_url && !(canValidate && report.status === "submitted") && (
                          <span className="muted-cell">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {preview && (
        <div className="ds-dialog-overlay" role="presentation" onClick={closePreview}>
          <div
            className="ds-dialog ds-dialog--wide report-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="ds-dialog__header ds-dialog__header--row">
              <h3 id="report-preview-title">{preview.title}</h3>
              <button type="button" className="ds-dialog__icon-close" onClick={closePreview} aria-label="Fermer">
                x
              </button>
            </header>
            <div className="ds-dialog__body report-preview-body">
              <iframe className="report-preview-frame" title={preview.title} src={preview.url} />
            </div>
            <footer className="ds-dialog__footer">
              <Button type="button" variant="secondary" onClick={closePreview}>
                Fermer
              </Button>
              <Button type="button" onClick={() => window.open(preview.url, "_blank", "noopener,noreferrer")}>
                Ouvrir dans un onglet
              </Button>
            </footer>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default ReportsPageEnhanced;
