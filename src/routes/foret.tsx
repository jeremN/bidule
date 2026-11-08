import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/foret.js');

export const Route = createFileRoute('/foret')({
  head: () => ({ meta: [{ title: 'Bidule · La Forêt' }] }),
  component: () => <WorldStage load={load} />
});
