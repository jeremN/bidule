import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/carriere.js');

export const Route = createFileRoute('/carriere')({
  head: () => ({ meta: [{ title: 'Bidule · La Carrière' }] }),
  component: () => <WorldStage load={load} />
});
