import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/chantier.js');

export const Route = createFileRoute('/chantier')({
  head: () => ({ meta: [{ title: 'Bidule · Le Chantier' }] }),
  component: () => <WorldStage load={load} />
});
