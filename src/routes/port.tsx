import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/port.js');

export const Route = createFileRoute('/port')({
  head: () => ({ meta: [{ title: 'Bidule · Le Port' }] }),
  component: () => <WorldStage load={load} />
});
