import { useParams } from "react-router-dom";

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <main>
      <h1>Request detail</h1>
      <p>Request {id}: not implemented yet.</p>
    </main>
  );
}
