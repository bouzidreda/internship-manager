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

const ReportsPageEnhanced = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

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
      const response = await apiClient.get(`/reports/${report.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      const message = err.response?.data?.message || "Apercu du PDF impossible.";
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (report) => {
    try {
      setBusyId(report.id);
      const response = await apiClient.get(`/reports/${report.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.title || "rapport"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err.response?.data?.message || "Telechargement du PDF impossible.";
      showToast(message, "error");
    } finally {
      setBusyId(null);
    }
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
    </PageLayout>
  );
};

export default ReportsPageEnhanced;
