import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getHomePathForRole } from "../utils/roleHome";
import LandingHeroVisual from "../components/LandingHeroVisual";
import ThemeToggle from "../components/ThemeToggle";

const workflowSteps = [
  {
    title: "Création d’un projet",
    label: "Project Stage",
    description: "Définissez le contexte, les objectifs et les livrables du stage.",
    icon: "📁"
  },
  {
    title: "Ajout des stagiaires",
    label: "Add Intern",
    description: "Le superviseur ajoute les profils et les assigne au bon projet.",
    icon: "👥"
  },
  {
    title: "Affectation au projet",
    label: "Matching",
    description: "Le stagiaire est positionné sur un projet adapté à son profil.",
    icon: "🎯"
  },
  {
    title: "Suivi des tâches",
    label: "Progression",
    description: "Les missions, validations et avancées sont suivies en temps réel.",
    icon: "📈"
  }
];

const keyFeatures = [
  {
    title: "Gestion des stagiaires",
    description: "Créez, affectez et pilotez les parcours stagiaires sans friction.",
    icon: "👤"
  },
  {
    title: "Gestion des projets",
    description: "Structurez les missions, les responsables et les livrables par projet.",
    icon: "🗂️"
  },
  {
    title: "Suivi opérationnel",
    description: "Gardez une vue claire sur les tâches, progrès et validations.",
    icon: "✅"
  }
];

const testimonials = [
  {
    quote:
      "On a réduit le temps de sélection des stagiaires et le suivi des projets est devenu beaucoup plus lisible.",
    name: "Sarah M.",
    role: "Responsable RH",
    company: "NovaTech"
  },
  {
    quote:
      "L’enchaînement Projet → Add Intern → affectation est simple à expliquer à toute l’équipe.",
    name: "Yassine B.",
    role: "Superviseur",
    company: "StageFlow Partner"
  },
  {
    quote:
      "Le suivi des tâches et des progrès nous donne enfin une vraie visibilité sans tableur dispersé.",
    name: "Amel R.",
    role: "Chef de projet",
    company: "Digital Studio"
  }
];

const visualShowcase = [
  {
    title: "Collaboration d'équipe",
    caption: "Des échanges plus rapides entre superviseurs et stagiaires.",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
    alt: "Équipe en réunion autour d'un projet"
  },
  {
    title: "Suivi de projet",
    caption: "Un espace clair pour suivre les tâches et les livrables.",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80",
    alt: "Personne travaillant sur un tableau de bord de projet"
  },
  {
    title: "Analyse et pilotage",
    caption: "Une lecture immédiate des indicateurs et de la progression.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    alt: "Équipe analysant des données sur un écran"
  }
];

const LandingPage = () => {
  const { isAuthenticated, user } = useAuth();
  const platformPath = isAuthenticated ? getHomePathForRole(user?.role) : "/register";

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="landing-brand-mark" />
          <div>
            <strong>StageFlow</strong>
            <p>Plateforme de gestion de stages</p>
          </div>
        </div>

        <nav className="landing-actions">
          <ThemeToggle />
          <Link className="ghost-btn" to="/login">
            Se connecter
          </Link>
          <Link className="primary-btn" to={platformPath}>
            {isAuthenticated ? "Ouvrir la plateforme" : "Demarrer"}
          </Link>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-tag">Gestion de stages, projets et suivi en un seul espace</p>
            <h1>
              Une plateforme claire pour structurer les projets, intégrer les stagiaires et piloter la progression.
            </h1>
            <p>
              StageFlow centralise la création des projets, l’ajout des stagiaires et le suivi des tâches dans un parcours fluide.
            </p>
            <div className="hero-cta">
              <Link className="primary-btn" to={platformPath}>
                Découvrir la plateforme
              </Link>
              <Link className="ghost-btn" to="#workflow">
                Voir le workflow
              </Link>
            </div>
          </div>

          <LandingHeroVisual />
        </section>

        <section id="workflow" className="landing-section">
          <div className="section-head">
            <p>Comment ça marche</p>
            <h2>Un workflow simple, du projet à la progression</h2>
          </div>

          <div className="workflow-grid">
            {workflowSteps.map((step, index) => (
              <article className="workflow-card" key={step.title}>
                <div className="workflow-card-icon" aria-hidden="true">
                  <span>{step.icon}</span>
                </div>
                <div className="workflow-card-number">0{index + 1}</div>
                <p className="workflow-card-label">{step.label}</p>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="section-head">
            <p>Fonctionnalités clés</p>
            <h2>Tout ce qu’il faut pour gérer les stages proprement</h2>
          </div>

          <div className="feature-grid feature-grid-highlighted">
            {keyFeatures.map((feature) => (
              <article className="feature-card feature-card-illustrated" key={feature.title}>
                <div className="feature-icon" aria-hidden="true">
                  <span>{feature.icon}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="section-head">
            <p>Visuels du terrain</p>
            <h2>Quelques images web pour donner un vrai relief à la plateforme</h2>
          </div>

          <div className="landing-visual-grid">
            {visualShowcase.map((item) => (
              <article className="landing-visual-card" key={item.title}>
                <div className="landing-visual-media">
                  <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
                </div>
                <div className="landing-visual-copy">
                  <h3>{item.title}</h3>
                  <p>{item.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <div className="section-head">
            <p>Témoignages</p>
            <h2>Une expérience pensée pour être simple à adopter</h2>
          </div>

          <div className="testimonial-grid">
            {testimonials.map((testimonial) => (
              <article className="testimonial-card" key={testimonial.name}>
                <div className="testimonial-quote-mark">“</div>
                <p>{testimonial.quote}</p>
                <div className="testimonial-footer">
                  <strong>{testimonial.name}</strong>
                  <span>
                    {testimonial.role} · {testimonial.company}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <h2>Prets a fluidifier votre gestion des stages ?</h2>
          <p>
            Lancez votre espace en quelques minutes pour connecter les talents aux bonnes equipes.
          </p>
          <div className="hero-cta">
            <Link className="primary-btn" to={platformPath}>
              Creer un compte
            </Link>
            <Link className="ghost-btn" to="/login">
              J ai deja un compte
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
