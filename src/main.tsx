import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { Cursor } from "@/components/Cursor";
import { AuthProvider } from "@/hooks/useAuth";
import "@/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Cursor />
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
