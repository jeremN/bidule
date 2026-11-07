import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home
});

const worlds = [
  {
    to: '/chantier' as const,
    title: 'Le Chantier',
    text: 'La pelleteuse, le camion-benne, le bulldozer, la grue, la toupie et le rouleau.',
    art: (
      <svg viewBox="0 0 240 110" aria-hidden="true">
        <path d="M8 104H232" stroke="#d3d8ea" strokeWidth="4" strokeLinecap="round" />
        <rect x="20" y="78" width="96" height="22" rx="11" fill="#2b3040" />
        <rect x="24" y="48" width="84" height="30" rx="5" fill="#f4b42a" />
        <rect x="62" y="20" width="34" height="30" rx="4" fill="#f4b42a" />
        <rect x="69" y="26" width="20" height="16" fill="#7fcdee" />
        <path d="M104 52L148 14L180 58" fill="none" stroke="#f4b42a" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M168 56h26l-5 22h-18z" fill="#d88f14" />
        <rect x="196" y="20" width="6" height="84" fill="#e5452c" />
        <rect x="150" y="16" width="86" height="6" fill="#e5452c" />
      </svg>
    )
  },
  {
    to: '/ferme' as const,
    title: 'La Ferme',
    text: 'Le tracteur, le semoir, le pulvérisateur, la moissonneuse, la presse et le télescopique.',
    art: (
      <svg viewBox="0 0 240 110" aria-hidden="true">
        <path d="M8 104H232" stroke="#d3d8ea" strokeWidth="4" strokeLinecap="round" />
        <rect x="88" y="54" width="70" height="24" rx="4" fill="#c8322a" />
        <rect x="58" y="14" width="40" height="44" rx="3" fill="#2b3040" />
        <rect x="64" y="20" width="28" height="28" fill="#7fcdee" />
        <rect x="54" y="10" width="48" height="7" rx="3" fill="#c8322a" />
        <circle cx="78" cy="78" r="26" fill="#2b3040" />
        <circle cx="78" cy="78" r="10" fill="#f4b42a" />
        <circle cx="144" cy="90" r="14" fill="#2b3040" />
        <circle cx="144" cy="90" r="5" fill="#f4b42a" />
        <g fill="#e9b52f">
          <rect x="176" y="40" width="5" height="64" />
          <rect x="190" y="34" width="5" height="70" />
          <rect x="204" y="44" width="5" height="60" />
          <rect x="218" y="38" width="5" height="66" />
        </g>
        <path d="M10 92l18-24h22l-8 24z" fill="#9aa4b6" />
      </svg>
    )
  },
  {
    to: '/espace' as const,
    title: "L'Espace",
    text: 'La fusée, la navette spatiale, le transporteur, le rover sur Mars et le module sur la Lune.',
    art: (
      <svg viewBox="0 0 240 110" aria-hidden="true">
        <path d="M8 104H232" stroke="#d3d8ea" strokeWidth="4" strokeLinecap="round" />
        <g fill="#f5d27a"><circle cx="30" cy="20" r="2" /><circle cx="60" cy="40" r="1.5" /><circle cx="200" cy="18" r="2" /><circle cx="170" cy="50" r="1.5" /><circle cx="216" cy="70" r="1.5" /></g>
        <circle cx="190" cy="34" r="16" fill="#3a7bd8" /><path d="M180 28q8-6 14 2t-4 12q-10-2-10-14z" fill="#5aa85a" />
        <rect x="104" y="30" width="22" height="64" rx="3" fill="#f4f5f8" stroke="#c9ccd8" strokeWidth="2" /><path d="M104 30q11-26 22 0z" fill="#f4f5f8" stroke="#c9ccd8" strokeWidth="2" />
        <rect x="90" y="54" width="12" height="40" rx="3" fill="#f4f5f8" stroke="#c9ccd8" strokeWidth="2" /><rect x="128" y="54" width="12" height="40" rx="3" fill="#f4f5f8" stroke="#c9ccd8" strokeWidth="2" />
        <rect x="104" y="58" width="22" height="5" fill="#1b1d24" /><path d="M108 96l7 8 7-8z" fill="#ffb547" />
        <rect x="40" y="24" width="6" height="80" fill="#e5452c" /><rect x="46" y="44" width="40" height="5" fill="#e5452c" />
      </svg>
    )
  }
];

function Home() {
  return (
    <main className="hub">
      <h1>
        Bi<span>dule</span>
      </h1>
      <p className="lead">Des machines en 3D qu'on fait marcher pour comprendre comment elles fonctionnent. Pour les petits, dès la maternelle.</p>
      <section className="worlds" aria-label="Les mondes">
        {worlds.map((w) => (
          <Link key={w.to} to={w.to} className="world">
            {w.art}
            <h2>{w.title}</h2>
            <p>{w.text}</p>
            <b>Jouer</b>
          </Link>
        ))}
      </section>
      <footer>
        Fait à la maison. Code sur <a href="https://github.com/jeremN/bidule">GitHub</a>.
      </footer>
    </main>
  );
}
