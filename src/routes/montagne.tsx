import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/montagne.js');

export const Route = createFileRoute('/montagne')({
  head: () => ({ meta: [{ title: 'Bidule · La Montagne' }] }),
  component: () => <WorldStage load={load} />
});
