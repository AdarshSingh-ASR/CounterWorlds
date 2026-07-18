import { CounterWorldsApp } from "../../../components/CounterWorldsApp";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <CounterWorldsApp mode="student" initialCode={code.toUpperCase()} />;
}
