import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Input } from "../components/Input";
import styles from "./LoginPage.module.css";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) {
    return <Navigate to="/requests" replace />;
  }

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/requests";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            IAS
          </span>
          Disbursements
        </div>

        <div className={styles.card}>
          <h1>Login</h1>
          <p className={styles.subtitle}>Sign in to review and decide supplier disbursement requests.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <Field htmlFor="username" label="Username">
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>

            <Field htmlFor="password" label="Password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>

            {error && (
              <Alert variant="error" role="alert">
                {error}
              </Alert>
            )}

            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>

        <p className={styles.footnote}>Internal disbursement operations tool.</p>
      </div>
    </main>
  );
}
