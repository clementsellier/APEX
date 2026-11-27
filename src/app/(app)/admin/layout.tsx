import { AdminNav } from "./admin-nav";

// Cadre du back-office : onglets communs. Chaque page vérifie elle-même le rôle ADMIN.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-col gap-8">
      <AdminNav />
      {children}
    </div>
  );
}
