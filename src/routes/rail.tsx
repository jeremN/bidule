import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/rail.js');

export const Route = createFileRoute('/rail')({
  head: () => ({ meta: [{ title: 'Bidule · Le Chemin de fer' }] }),
  component: () => <WorldStage load={load} />
});
