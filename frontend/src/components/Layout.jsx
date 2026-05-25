import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../api/client";
import ThemeToggle from "./ThemeToggle";
import { getHomePathForRole } from "../utils/roleHome";

const NAV_ICONS = {
  dashboard: "◫",
  stats: "◎",
  project: "◇",
  projects: "▣",
  addIntern: "＋",
  assign: "⇢",
  notifications: "◉",
  tasks: "☑",
  reports: "▤",
  companies: "▦",
  students: "◎",
  supervisors: "◈",
  profile: "○"
};

const NavItem = ({ to, icon, children, onClick, badge }) => {
  const link = (
    <NavLink to={to} onClick={onClick}>
      <span className="nav-link-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </NavLink>
  );

  if (badge != null) {
    return (
      <div className="nav-link-with-badge">
        {link}
        {badge > 0 && <span className="notification-badge">{badge}</span>}
      </div>
    );
  }

  return link;
};

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const initials = (user?.email || "").charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen((current) => !current);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await apiClient.get("/workflow/notifications/unread-count");
        setUnreadCount(response.data.unreadCount || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    if (!user) {
      return undefined;
    }

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const profilePath =
    user?.role === "supervisor"
      ? "/app/supervisor/profile"
      : user?.role === "student"
        ? "/app/student/profile"
        : "/app/admin/profile";

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={isMobileMenuOpen}
      >
        ☰
      </button>

      <div
        className={`mobile-overlay ${isMobileMenuOpen ? "visible" : ""}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isMobileMenuOpen ? "open" : ""}`} aria-label="Navigation principale">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-dot" />
            <div>
              <h1>StageFlow</h1>
              <p>Gestion des stages</p>
            </div>
          </div>

          <div className="sidebar-user">
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="user-meta">
              <div className="user-email">{user?.email || "Invité"}</div>
              <span className="role-badge">{user?.role || "guest"}</span>
            </div>
          </div>
        </div>

        <nav className="nav-links" role="navigation">
          <div className="nav-group">
            <div className="nav-group-title">Vue d&apos;ensemble</div>
            {user?.role === "admin" ? (
              <>
                <NavItem to="/app/dashboard" icon={NAV_ICONS.dashboard} onClick={closeMobileMenu}>
                  Tableau de bord
                </NavItem>
                <NavItem to="/app/enhanced-dashboard" icon={NAV_ICONS.stats} onClick={closeMobileMenu}>
                  Statistiques avancées
                </NavItem>
              </>
            ) : (
              <NavItem to={getHomePathForRole(user?.role)} icon={NAV_ICONS.dashboard} onClick={closeMobileMenu}>
                Tableau de bord
              </NavItem>
            )}
          </div>

          {(user?.role === "student" || user?.role === "supervisor") && (
            <div className="nav-group">
              <div className="nav-group-title">
                {user?.role === "supervisor" ? "Supervision" : "Espace stagiaire"}
              </div>
              {user?.role === "student" && (
                <NavItem to="/app/student/my-project" icon={NAV_ICONS.project} onClick={closeMobileMenu}>
                  Mon projet
                </NavItem>
              )}
              {user?.role === "supervisor" && (
                <NavItem to="/app/supervisor/my-projects" icon={NAV_ICONS.projects} onClick={closeMobileMenu}>
                  Mes projets
                </NavItem>
              )}
              {user?.role === "supervisor" && (
                <NavItem to="/app/supervisor/add-intern" icon={NAV_ICONS.addIntern} onClick={closeMobileMenu}>
                  Ajouter un stagiaire
                </NavItem>
              )}
              {user?.role === "supervisor" && (
                <NavItem to="/app/supervisor/assign-intern" icon={NAV_ICONS.assign} onClick={closeMobileMenu}>
                  Affecter un stagiaire
                </NavItem>
              )}
            </div>
          )}

          {(user?.role === "student" || user?.role === "supervisor") && (
            <div className="nav-group">
              <div className="nav-group-title">Travail</div>
              <NavItem
                to="/app/notifications"
                icon={NAV_ICONS.notifications}
                onClick={closeMobileMenu}
                badge={unreadCount}
              >
                Notifications
              </NavItem>
              <NavItem to="/app/tasks" icon={NAV_ICONS.tasks} onClick={closeMobileMenu}>
                Tâches
              </NavItem>
              <NavItem to="/app/reports" icon={NAV_ICONS.reports} onClick={closeMobileMenu}>
                Rapports
              </NavItem>
            </div>
          )}

          {user?.role === "admin" && (
            <div className="nav-group">
              <div className="nav-group-title">Administration</div>
              <NavItem to="/app/admin/rh-companies" icon={NAV_ICONS.companies} onClick={closeMobileMenu}>
                Entreprises
              </NavItem>
              <NavItem to="/app/admin/students" icon={NAV_ICONS.students} onClick={closeMobileMenu}>
                Stagiaires
              </NavItem>
              <NavItem to="/app/admin/supervisors" icon={NAV_ICONS.supervisors} onClick={closeMobileMenu}>
                Superviseurs
              </NavItem>
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          {(user?.role === "supervisor" || user?.role === "student" || user?.role === "admin") && (
            <NavLink className="sidebar-footer-link" onClick={closeMobileMenu} to={profilePath}>
              Mon profil
            </NavLink>
          )}
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h2>Bienvenue</h2>
            <p>{user?.email}</p>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <span className="topbar-role">{user?.role}</span>
          </div>
        </header>

        <section className="page-wrapper">
          <Outlet />
        </section>
      </main>
    </div>
  );
};

export default Layout;
