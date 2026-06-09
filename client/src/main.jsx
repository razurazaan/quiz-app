import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

const routerBaseName = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBaseName}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#16161f",
            color: "#f0eeff",
            border: "1px solid #2a2a3a",
            fontFamily: "DM Sans, sans-serif",
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
