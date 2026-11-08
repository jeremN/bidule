import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/fete.js');

export const Route = createFileRoute('/fete')({
  head: () => ({ meta: [{ title: 'Bidule · La Fête foraine' }] }),
  component: () => <WorldStage load={load} />
});
