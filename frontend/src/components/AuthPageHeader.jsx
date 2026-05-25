import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const AuthPageHeader = () => {
  return (
    <header className="landing-nav auth-topbar">
      <div className="landing-brand">
        <span className="landing-brand-mark" />
        <div>
          <strong>StageFlow</strong>
          <p>Plateforme de gestion de stages</p>
        </div>
      </div>

      <nav className="landing-actions">
        <ThemeToggle />
        <Link className="ghost-btn" to="/">
          Retour page d'accueil
        </Link>
      </nav>
    </header>
  );
};

export default AuthPageHeader;
