import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/ville.js');

export const Route = createFileRoute('/ville')({
  head: () => ({ meta: [{ title: 'Bidule · La Ville' }] }),
  component: () => <WorldStage load={load} />
});
