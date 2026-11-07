import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/ferme.js');

export const Route = createFileRoute('/ferme')({
  head: () => ({ meta: [{ title: 'Bidule · La Ferme' }] }),
  component: () => <WorldStage load={load} />
});
