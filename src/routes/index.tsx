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
