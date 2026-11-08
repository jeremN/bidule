import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home
});

const INK = '#2a2440';
// shared outline for every drawn shape (sky and ground stay flat)
const ol = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const worlds = [
  {
    to: '/chantier' as const,
    title: 'Le Chantier',
    text: 'Tout un quartier en construction : la pelleteuse, la grue, la pompe à béton, et toutes les machines qui font la route.',
    art: (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id="ch-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a8" /><stop offset="1" stopColor="#ffb98f" /></linearGradient>
        </defs>
        <rect width="240" height="150" fill="url(#ch-sky)" />
        <circle cx="38" cy="34" r="17" fill="#fff4d2" />
        <g fill="#fff" opacity=".85"><ellipse cx="96" cy="26" rx="18" ry="7" /><ellipse cx="110" cy="21" rx="12" ry="8" /></g>
        {/* tower crane in the back */}
        <g {...ol} fill="none" stroke="#e5452c" strokeWidth="3">
          <path d="M204 118V22M216 118V22M204 30l12 12-12 12 12 12-12 12 12 12-12 12 12 12" />
          <path d="M150 22H238M150 28H238" />
        </g>
        <path d="M168 28v28" stroke={INK} strokeWidth="2" />
        <rect {...ol} x="161" y="56" width="14" height="10" rx="2" fill="#7fcdee" />
        <rect {...ol} x="222" y="28" width="14" height="12" rx="2" fill="#9aa4b6" />
        <path d="M0 118Q60 106 120 114T240 110V150H0Z" fill="#d79a66" />
        <path d="M0 132Q80 124 160 132T240 128V150H0Z" fill="#c4834f" />
        {/* dirt pile */}
        <path {...ol} d="M146 120Q176 82 214 120Z" fill="#b8733f" />
        <g fill="#8d5530"><circle cx="170" cy="108" r="2.5" /><circle cx="186" cy="112" r="2" /><circle cx="178" cy="100" r="2" /></g>
        <g className="bob">
          <rect {...ol} x="34" y="106" width="86" height="20" rx="10" fill="#3a3550" />
          <g fill="#9b96b8" {...ol} strokeWidth="2"><circle cx="46" cy="116" r="5" /><circle cx="65" cy="116" r="5" /><circle cx="84" cy="116" r="5" /><circle cx="103" cy="116" r="5" /></g>
          <rect {...ol} x="34" y="84" width="16" height="20" rx="5" fill="#e09a10" />
          <rect {...ol} x="44" y="80" width="68" height="26" rx="7" fill="#f6b81f" />
          <rect {...ol} x="74" y="48" width="34" height="34" rx="6" fill="#f6b81f" />
          <rect {...ol} x="80" y="54" width="22" height="19" rx="4" fill="#9fe0ff" />
          <path d="M85 58l8 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="56" cy="92" r="3" fill={INK} />
          <path d="M106 88L138 50L168 84" fill="none" stroke={INK} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M106 88L138 50L168 84" fill="none" stroke="#f6b81f" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path {...ol} d="M158 82h22l-3 18q-10 7-19-2z" fill="#e09a10" />
          <rect {...ol} x="92" y="40" width="6" height="8" rx="2" fill="#ff7a2e" />
        </g>
        <g {...ol}>
          <path d="M10 130l7-20 7 20z" fill="#ff7a2e" /><path d="M13 121h8" stroke="#fff" strokeWidth="3" />
          <path d="M218 134l7-20 7 20z" fill="#ff7a2e" /><path d="M221 125h8" stroke="#fff" strokeWidth="3" />
        </g>
      </svg>
    )
  },
  {
    to: '/ferme' as const,
    title: 'La Ferme',
    text: 'Une grande ferme avec ses vaches : le tracteur, la moissonneuse, la faucheuse, la presse, l’enrubanneuse…',
    art: (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id="fe-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9dcff" /><stop offset="1" stopColor="#e6f6ff" /></linearGradient>
        </defs>
        <rect width="240" height="150" fill="url(#fe-sky)" />
        <circle cx="206" cy="28" r="15" fill="#ffd65a" />
        <g fill="#fff"><ellipse cx="44" cy="28" rx="20" ry="8" /><ellipse cx="58" cy="22" rx="12" ry="9" /><ellipse cx="140" cy="20" rx="14" ry="6" /></g>
        <path d="M0 92Q60 70 130 88T240 80V150H0Z" fill="#a6db7a" />
        <path d="M0 112Q120 96 240 108V150H0Z" fill="#f2c84b" />
        <g stroke="#dca935" strokeWidth="2.5" strokeLinecap="round"><path d="M0 120Q120 106 240 116" fill="none" /><path d="M0 130Q120 118 240 126" fill="none" /><path d="M0 140Q120 130 240 136" fill="none" /></g>
        {/* barn */}
        <g {...ol}>
          <rect x="178" y="68" width="52" height="48" fill="#d8473b" />
          <path d="M172 72L204 46L236 72Z" fill="#a8322c" />
          <rect x="193" y="86" width="22" height="30" fill="#fff" />
          <path d="M193 86l22 30M215 86l-22 30" />
          <circle cx="204" cy="62" r="5" fill="#fff4d2" />
        </g>
        <g {...ol}><circle cx="22" cy="124" r="11" fill="#f2c84b" /><path d="M22 124m-5 0a5 5 0 1 0 5-5" fill="none" strokeWidth="2" /></g>
        <g className="bob">
          <circle cx="132" cy="54" r="5" fill="#fff" opacity=".9" /><circle cx="140" cy="42" r="7" fill="#fff" opacity=".8" />
          <rect {...ol} x="124" y="60" width="6" height="26" rx="2" fill="#3a3550" />
          <rect {...ol} x="94" y="82" width="58" height="26" rx="7" fill="#e8423a" />
          <rect {...ol} x="146" y="88" width="8" height="16" rx="2" fill="#b52c25" />
          <rect {...ol} x="56" y="50" width="42" height="48" rx="4" fill="#9fe0ff" />
          <path d="M66 56l12 16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <path {...ol} d="M77 50v48" />
          <rect {...ol} x="50" y="42" width="54" height="10" rx="5" fill="#e8423a" />
          <circle {...ol} cx="76" cy="112" r="25" fill="#3a3550" />
          <circle {...ol} cx="76" cy="112" r="10" fill="#ffd23f" />
          <path d="M46 104a30 30 0 0 1 60 0" fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" />
          <path d="M46 104a30 30 0 0 1 60 0" fill="none" stroke="#e8423a" strokeWidth="6" strokeLinecap="round" />
          <circle {...ol} cx="138" cy="120" r="14" fill="#3a3550" />
          <circle {...ol} cx="138" cy="120" r="5" fill="#ffd23f" />
        </g>
      </svg>
    )
  },
  {
    to: '/espace' as const,
    title: "L'Espace",
    text: 'Une base spatiale : la fusée, la navette, le bus des astronautes, la station, la capsule, le rover…',
    art: (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id="es-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#17194a" /><stop offset="1" stopColor="#4a3a92" /></linearGradient>
        </defs>
        <rect width="240" height="150" fill="url(#es-sky)" />
        <g fill="#fff4c2">
          <circle cx="20" cy="18" r="1.6" /><circle cx="58" cy="40" r="1.2" /><circle cx="90" cy="14" r="1.8" /><circle cx="150" cy="30" r="1.3" />
          <circle cx="172" cy="70" r="1.2" /><circle cx="226" cy="84" r="1.6" /><circle cx="30" cy="70" r="1.3" /><circle cx="76" cy="84" r="1" />
          <path d="M160 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </g>
        <g {...ol}>
          <circle cx="200" cy="40" r="18" fill="#ff9b6a" />
          <path d="M184 34q6-4 12 0" fill="none" stroke="#e0744a" strokeWidth="3" />
          <ellipse cx="200" cy="40" rx="30" ry="7" fill="none" stroke="#ffd65a" strokeWidth="3" transform="rotate(-14 200 40)" />
        </g>
        <path d="M0 122Q120 106 240 124V150H0Z" fill="#cfcbef" />
        <g fill="#aba6d8"><ellipse cx="190" cy="134" rx="14" ry="4" /><ellipse cx="40" cy="138" rx="10" ry="3" /><ellipse cx="150" cy="142" rx="7" ry="2" /></g>
        <g className="bob">
          <g fill="#fff" opacity=".9"><circle cx="102" cy="128" r="9" /><circle cx="138" cy="128" r="9" /><circle cx="120" cy="134" r="10" /></g>
          <path d="M112 102Q120 138 128 102Z" fill="#ffb347" />
          <path d="M116 102Q120 124 124 102Z" fill="#fff07a" />
          <g {...ol}>
            <path d="M108 78L92 102L108 96Z" fill="#ff5a4e" />
            <path d="M132 78L148 102L132 96Z" fill="#ff5a4e" />
            <path d="M108 98V56Q108 30 120 16Q132 30 132 56V98Z" fill="#f4f5fb" />
            <path d="M110.5 40Q113 26 120 16Q127 26 129.5 40Z" fill="#ff5a4e" />
            <circle cx="120" cy="60" r="7.5" fill="#7fd0ff" />
            <rect x="113" y="98" width="14" height="6" rx="2" fill="#6a6890" />
          </g>
          <path d="M116.5 57l4 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        {/* astronaut waving */}
        <g {...ol}>
          <path d="M60 96V132" fill="none" />
          <path d="M60 96h20l-4 7 4 7H60Z" fill="#ffd65a" />
          <rect x="30" y="104" width="22" height="22" rx="7" fill="#f4f5fb" />
          <rect x="24" y="106" width="8" height="16" rx="3" fill="#cfd2e2" />
          <path d="M50 108l9-12" fill="none" stroke={INK} strokeWidth="8" />
          <path d="M50 108l9-12" fill="none" stroke="#f4f5fb" strokeWidth="4" />
          <rect x="33" y="124" width="7" height="10" rx="3" fill="#f4f5fb" /><rect x="43" y="124" width="7" height="10" rx="3" fill="#f4f5fb" />
          <circle cx="41" cy="96" r="11" fill="#f4f5fb" />
          <rect x="35" y="91" width="13" height="9" rx="4.5" fill="#ffc94a" />
        </g>
      </svg>
    )
  },
  {
    to: '/ville' as const,
    title: 'La Ville',
    text: 'Une ville japonaise : la voiture, le tramway, le métro, les pompiers, le bateau-bus, le Shinkansen…',
    art: (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id="vi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd3e0" /><stop offset="1" stopColor="#ffefd2" /></linearGradient>
        </defs>
        <rect width="240" height="150" fill="url(#vi-sky)" />
        <circle cx="62" cy="38" r="18" fill="#ff6b5a" />
        <path d="M120 100L178 30L240 100Z" fill="#8a97da" />
        <path d="M164 47L178 30L193 47L186 52L179 46L172 52Z" fill="#fff" />
        <g fill="#c9b6ea">
          <rect x="6" y="56" width="22" height="46" /><rect x="32" y="66" width="18" height="36" /><rect x="96" y="60" width="20" height="42" />
        </g>
        <g fill="#fff" opacity=".6"><rect x="11" y="62" width="4" height="5" /><rect x="19" y="62" width="4" height="5" /><rect x="11" y="72" width="4" height="5" /><rect x="19" y="82" width="4" height="5" /><rect x="101" y="68" width="4" height="5" /><rect x="108" y="78" width="4" height="5" /></g>
        <path d="M0 126Q120 116 240 128V150H0Z" fill="#9ad17a" />
        <g {...ol} fill="#d8d3e6">
          <rect x="-4" y="100" width="248" height="7" />
          <rect x="30" y="107" width="10" height="24" /><rect x="114" y="107" width="10" height="22" /><rect x="198" y="107" width="10" height="24" />
        </g>
        <g className="bob">
          <path {...ol} d="M8 98V82Q8 76 15 76H150Q192 76 220 95Q222 98 218 98Z" fill="#f6f7fb" />
          <path d="M9 90H210L214 94H9Z" fill="#2f6fe0" />
          <g fill="#2a3f78">
            <rect x="20" y="80" width="10" height="6" rx="2" /><rect x="36" y="80" width="10" height="6" rx="2" /><rect x="52" y="80" width="10" height="6" rx="2" />
            <rect x="68" y="80" width="10" height="6" rx="2" /><rect x="84" y="80" width="10" height="6" rx="2" /><rect x="100" y="80" width="10" height="6" rx="2" />
            <rect x="116" y="80" width="10" height="6" rx="2" /><rect x="132" y="80" width="10" height="6" rx="2" />
            <path d="M164 80Q184 81 200 89L166 89Z" />
          </g>
          <path {...ol} d="M60 76v22M120 76v22" fill="none" strokeWidth="1.5" />
        </g>
        {/* torii and sakura in front */}
        <g {...ol}>
          <rect x="62" y="122" width="4" height="22" fill="#e5452c" /><rect x="84" y="122" width="4" height="22" fill="#e5452c" />
          <path d="M55 116h40l-3 6H58Z" fill="#3a2a22" /><rect x="59" y="126" width="32" height="3.5" fill="#e5452c" />
          <path d="M206 140V118" fill="none" stroke="#7a4a3a" strokeWidth="5" />
        </g>
        <g {...ol} fill="#f7b6cf"><circle cx="196" cy="112" r="10" /><circle cx="214" cy="110" r="11" /><circle cx="205" cy="100" r="11" /></g>
        <g fill="#fff" opacity=".8"><circle cx="200" cy="104" r="2" /><circle cx="212" cy="112" r="2" /><circle cx="192" cy="114" r="1.6" /></g>
      </svg>
    )
  },
  {
    to: '/aeroport' as const,
    title: "L'Aéroport",
    text: "Les avions qui décollent et atterrissent, la passerelle, les valises, le plein, les repas, le pushback…",
    art: (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id="ae-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd4ff" /><stop offset="1" stopColor="#e4f4ff" /></linearGradient>
        </defs>
        <rect width="240" height="150" fill="url(#ae-sky)" />
        <g fill="#fff"><ellipse cx="40" cy="30" rx="20" ry="7" /><ellipse cx="54" cy="25" rx="12" ry="8" /><ellipse cx="190" cy="56" rx="16" ry="6" /></g>
        <path d="M0 116H240V150H0Z" fill="#6a6e80" />
        <path d="M0 124H240" stroke="#f3efe2" strokeWidth="3" strokeDasharray="14 10" />
        <g {...ol}>
          <rect x="180" y="58" width="10" height="58" fill="#f4f5f8" /><rect x="172" y="48" width="26" height="12" rx="3" fill="#8ccaf0" /><rect x="174" y="44" width="22" height="5" fill="#2f6fe0" />
        </g>
        <g className="bob">
          <g transform="rotate(-12 110 70)" {...ol}>
            <path d="M40 72L58 54H76L66 72Z" fill="#2f6fe0" />
            <path d="M44 74Q44 66 54 66H150Q170 66 178 74Q170 82 150 82H54Q44 82 44 74Z" fill="#f6f7fb" />
            <path d="M100 76L84 102H100L122 76Z" fill="#c9ccd8" />
            <rect x="94" y="84" width="18" height="9" rx="4" fill="#8f96a6" />
            <path d="M160 70h8" stroke={INK} strokeWidth="4" />
          </g>
          <g fill="#2a2440">{[70, 80, 90, 100, 110, 120, 130].map((x) => <circle key={x} cx={x} cy={62 - (x - 70) * 0.21} r="2" />)}</g>
        </g>
        <g {...ol}><rect x="18" y="104" width="32" height="12" rx="3" fill="#f2b21c" /><circle cx="26" cy="118" r="4" fill="#3a3550" /><circle cx="42" cy="118" r="4" fill="#3a3550" /></g>
      </svg>
    )
  },
  {
    to: '/militaire' as const,
    title: 'La Base militaire',
    text: "Le char qui passe partout, le pont qui se déplie, l'amphibie, l'hélicoptère, le drone, l'avion de chasse…",
    art: (
      <svg viewBox="0 0 240 150" aria-hidden="true">
        <defs>
          <linearGradient id="mi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe0c8" /><stop offset="1" stopColor="#eef6e4" /></linearGradient>
        </defs>
        <rect width="240" height="150" fill="url(#mi-sky)" />
        <g fill="#fff"><ellipse cx="190" cy="26" rx="18" ry="6" /><ellipse cx="204" cy="21" rx="11" ry="7" /></g>
        <g {...ol}>
          <path d="M150 40h72" /><rect x="183" y="40" width="6" height="7" fill="#2a2f2a" />
          <path d="M160 58q0-12 18-12h20q14 0 18 12-4 10-18 10h-20q-18 0-18-10z" fill="#6a7a52" />
          <path d="M162 58l-24-4v-6h6l18 6z" fill="#6a7a52" />
        </g>
        <path d="M0 112Q120 100 240 114V150H0Z" fill="#8a7a52" />
        <path d="M0 128Q120 120 240 130V150H0Z" fill="#7a6a42" />
        <g className="bob">
          <g {...ol}>
            <rect x="34" y="100" width="98" height="20" rx="10" fill="#46522a" />
            <g fill="#9b96b8"><circle cx="48" cy="110" r="5" /><circle cx="68" cy="110" r="5" /><circle cx="88" cy="110" r="5" /><circle cx="108" cy="110" r="5" /></g>
            <path d="M38 100l10-14h74l10 14z" fill="#5f6e3a" />
            <path d="M60 86q2-16 22-16h18q16 0 18 16z" fill="#5f6e3a" />
            <rect x="112" y="74" width="56" height="7" rx="3" fill="#46522a" />
            <rect x="78" y="62" width="12" height="8" rx="3" fill="#46522a" />
          </g>
        </g>
        <g {...ol}><rect x="16" y="54" width="4" height="58" fill="#f4f5f8" /><rect x="20" y="56" width="10" height="16" fill="#2f4fa8" /><rect x="30" y="56" width="10" height="16" fill="#f4f5f8" /><rect x="40" y="56" width="10" height="16" fill="#d8302a" /></g>
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
            <span className="art">{w.art}</span>
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
