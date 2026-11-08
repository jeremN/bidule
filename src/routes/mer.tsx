import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/mer.js');

export const Route = createFileRoute('/mer')({
  head: () => ({ meta: [{ title: 'Bidule · Sous la mer' }] }),
  component: () => <WorldStage load={load} />
});
