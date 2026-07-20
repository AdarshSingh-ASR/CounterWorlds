import { CounterWorldsApp } from "../../../components/CounterWorldsApp";
import { getAuthSession } from "../../../lib/auth-server";
import { redirect } from "next/navigation";

export default async function TeacherPage({ params }: { params: Promise<{ code: string }> }) {
  if (!await getAuthSession()) redirect("/sign-in");
  const { code } = await params;
  return <CounterWorldsApp mode="teacher" initialCode={code.toUpperCase()} />;
}
