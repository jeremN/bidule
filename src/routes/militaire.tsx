import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/militaire.js');

export const Route = createFileRoute('/militaire')({
  head: () => ({ meta: [{ title: 'Bidule · La Base militaire' }] }),
  component: () => <WorldStage load={load} />
});
