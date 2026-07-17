import QuizPlayer from "@/components/quiz/QuizPlayer";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <QuizPlayer token={token} />;
}
