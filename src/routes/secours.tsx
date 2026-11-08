import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/secours.js');

export const Route = createFileRoute('/secours')({
  head: () => ({ meta: [{ title: 'Bidule · Les Secours' }] }),
  component: () => <WorldStage load={load} />
});
