import { getProblemById } from "@/lib/problems";
import ProblemWorkspaceClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProblemPage({ params }: PageProps) {
  const { id } = await params;
  const problem = await getProblemById(id);

  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Problem Not Found</h1>
        <p className="text-muted-foreground">
          The problem with ID <code>{id}</code> could not be found.
        </p>
      </div>
    );
  }

  return <ProblemWorkspaceClient problem={problem} />;
}
