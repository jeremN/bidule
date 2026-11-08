import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/garage.js');

export const Route = createFileRoute('/garage')({
  head: () => ({ meta: [{ title: 'Bidule · Le Garage' }] }),
  component: () => <WorldStage load={load} />
});
