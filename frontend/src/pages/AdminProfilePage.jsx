import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import PasswordChangeCard from "../components/PasswordChangeCard";
import { useAuth } from "../hooks/useAuth";

const AdminProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { // how this helps ? 
    // This useEffect hook is responsible for initializing the admin profile data when 
    // the component mounts or when the user information changes. 
    // It sets the profile state with the user's email and role, 
    // and then updates the loading state to false, allowing the component to render the profile information.
    // I didn't understand ?
    // When the AdminProfilePage component is rendered, 
    // it needs to display the admin's email and role.
    setProfile({
      email: user?.email || "",
      role: user?.role || "admin"
    });
    setLoading(false);
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading profile..." />;

  return (
    <div className="page-grid page-grid-stack">
      <section className="card profile-header-card">
        <div className="profile-header-content">
          <div className="profile-title">
            <h2>Admin profile</h2>
            <p className="profile-subtitle">System administration account details.</p>
          </div>
        </div>
      </section>

      <div className="profile-content-grid">
        <section className="card profile-form-card">
          <div className="card-header">
            <h3>Account information</h3>
            <p className="card-description">Admin identity is managed directly from the authenticated user account.</p>
          </div>

          <div className="profile-form">
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="email" className="form-label">Email</label>
                <input id="email" type="email" value={profile?.email || ""} readOnly className="form-input readonly-input" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="role" className="form-label">Role</label>
                <input id="role" type="text" value={profile?.role || "admin"} readOnly className="form-input readonly-input" />
              </div>
            </div>
          </div>
        </section>

        <PasswordChangeCard />
      </div>
    </div>
  );
};

export default AdminProfilePage;
