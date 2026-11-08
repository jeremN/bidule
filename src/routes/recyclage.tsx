import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/recyclage.js');

export const Route = createFileRoute('/recyclage')({
  head: () => ({ meta: [{ title: 'Bidule · Le Recyclage' }] }),
  component: () => <WorldStage load={load} />
});
