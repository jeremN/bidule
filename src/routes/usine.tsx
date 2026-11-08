import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/usine.js');

export const Route = createFileRoute('/usine')({
  head: () => ({ meta: [{ title: "Bidule · L'Usine" }] }),
  component: () => <WorldStage load={load} />
});
