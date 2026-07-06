import { createBrowserRouter, Navigate } from "react-router-dom";
import Shell from "./components/Shell";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import MyWork from "./pages/MyWork";
import MyWorkSummary from "./pages/MyWorkSummary";
import Projects from "./pages/Projects";
import ProjectNew from "./pages/ProjectNew";
import ProjectDetail from "./pages/ProjectDetail";
import MeetingSummary from "./pages/MeetingSummary";
import Infrastructure from "./pages/Infrastructure";
import Team from "./pages/Team";
import AdminConsole from "./pages/AdminConsole";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";

// Routes mirror Sitemap & Screen Spec §1.
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Shell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/my-work" replace /> },
      { path: "my-work", element: <MyWork /> },
      { path: "my-summary", element: <MyWorkSummary /> },
      // Dashboard was merged into Projects — keep old links working.
      { path: "dashboard", element: <Navigate to="/projects" replace /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/new", element: <ProjectNew /> },
      { path: "projects/:id", element: <ProjectDetail /> },
      { path: "meeting-summary", element: <MeetingSummary /> },
      { path: "infrastructure", element: <Infrastructure /> },
      { path: "team", element: <Team /> },
      { path: "admin", element: <AdminConsole /> },
      { path: "clients", element: <Clients /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
