import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/livraison.js');

export const Route = createFileRoute('/livraison')({
  head: () => ({ meta: [{ title: 'Bidule · Le Colis' }] }),
  component: () => <WorldStage load={load} />
});
