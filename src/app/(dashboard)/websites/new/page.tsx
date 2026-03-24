import { WebsiteForm } from "@/components/website-form";

export default function NewWebsitePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Add Website</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Register a client website for automated maintenance testing.
        </p>
      </div>
      <WebsiteForm />
    </div>
  );
}
