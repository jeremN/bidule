import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/energie.js');

export const Route = createFileRoute('/energie')({
  head: () => ({ meta: [{ title: "Bidule · L'Énergie" }] }),
  component: () => <WorldStage load={load} />
});
