import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/espace.js');

export const Route = createFileRoute('/espace')({
  head: () => ({ meta: [{ title: "Bidule · L'Espace" }] }),
  component: () => <WorldStage load={load} />
});
