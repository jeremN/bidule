import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/aeroport.js');

export const Route = createFileRoute('/aeroport')({
  head: () => ({ meta: [{ title: 'Bidule · L’Aéroport' }] }),
  component: () => <WorldStage load={load} />
});
