import { CounterWorldsApp } from "../../../components/CounterWorldsApp";

export default async function TeacherPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <CounterWorldsApp mode="teacher" initialCode={code.toUpperCase()} />;
}
