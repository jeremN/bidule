import { createFileRoute } from '@tanstack/react-router';
import { WorldStage } from '../components/WorldStage';

const load = () => import('../worlds/travaux.js');

export const Route = createFileRoute('/travaux')({
  head: () => ({ meta: [{ title: 'Bidule · La Route' }] }),
  component: () => <WorldStage load={load} />
});
