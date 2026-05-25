import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { applyTheme, ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import "./styles.css";
import "./styles/design-system/index.css";

const storedTheme = window.localStorage.getItem("stageflow:theme");
const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
applyTheme(storedTheme === "dark" || storedTheme === "light" ? storedTheme : prefersDark ? "dark" : "light");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
