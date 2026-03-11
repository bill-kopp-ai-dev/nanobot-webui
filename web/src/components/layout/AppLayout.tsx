import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-5">
        <Outlet />
      </main>
    </div>
  );
}
