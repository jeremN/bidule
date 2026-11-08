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
  },
  {
      to: '/usine' as const,
      title: "L'Usine",
      text: "La presse, les robots soudeurs, la peinture, la chaîne de montage, le chariot élévateur, le camion porte-voitures…",
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="us-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8d8ff" /><stop offset="1" stopColor="#eaf6ff" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#us-sky)" />
          <g fill="#fff"><ellipse cx="46" cy="24" rx="18" ry="6" /><ellipse cx="60" cy="19" rx="11" ry="7" /></g>
          <g {...ol}>
            <path d="M120 112V58l20-14v14l20-14v14l20-14v14l20-14v68z" fill="#eee6d4" />
            <rect x="206" y="22" width="12" height="90" fill="#c9ced8" />
            <rect x="128" y="76" width="18" height="12" fill="#8cc4ec" /><rect x="154" y="76" width="18" height="12" fill="#8cc4ec" /><rect x="180" y="76" width="18" height="12" fill="#8cc4ec" />
          </g>
          <path d="M0 112H240V150H0Z" fill="#c7cad3" />
          <path d="M0 124H240" stroke="#f2c21c" strokeWidth="3" strokeDasharray="12 8" />
          <g className="bob">
            <g {...ol}>
              <rect x="26" y="104" width="30" height="10" rx="2" fill="#2a2f40" />
              <rect x="32" y="94" width="18" height="12" rx="4" fill="#f26a1a" />
              <path d="M41 96L52 58L96 48" fill="none" stroke={INK} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M41 96L52 58L96 48" fill="none" stroke="#f26a1a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="52" cy="58" r="7" fill="#3f4452" />
              <path d="M96 48l10 16" stroke={INK} strokeWidth="7" strokeLinecap="round" />
              <path d="M84 116V102q2-8 12-8h16l12-13h24q10 0 13 13v22z" fill="#e5302a" />
              <path d="M118 92l9-9h18q6 0 8 9z" fill="#8cc4ec" />
              <circle cx="102" cy="116" r="8" fill="#3a3550" /><circle cx="148" cy="116" r="8" fill="#3a3550" />
            </g>
            <g fill="#ffc24a"><circle cx="110" cy="70" r="3" /><circle cx="118" cy="64" r="2" /><circle cx="104" cy="66" r="2" /><circle cx="116" cy="74" r="1.8" /></g>
          </g>
        </svg>
      )
    },
  {
      to: '/carriere' as const,
      title: 'La Carrière',
      text: 'La foreuse, le brise-roche, la grosse pelle, le tombereau géant, le concasseur et le crible qui font du gravier…',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="ca-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3f4" /><stop offset="1" stopColor="#fbe9c8" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#ca-sky)" />
          <circle cx="206" cy="30" r="15" fill="#fff4d2" />
          <g fill="#fff" opacity=".85"><ellipse cx="60" cy="24" rx="18" ry="6" /><ellipse cx="74" cy="19" rx="11" ry="7" /></g>
          {/* the stepped quarry walls in the back, trees on the rim */}
          <g fill="#3f8f3a"><circle cx="14" cy="44" r="9" /><circle cx="30" cy="40" r="10" /><circle cx="196" cy="42" r="10" /><circle cx="214" cy="46" r="9" /><circle cx="230" cy="42" r="9" /></g>
          <path d="M0 50H240V112H0Z" fill="#cdb894" />
          <path d="M0 62H22V74H40V86H200V74H218V62H240V112H0Z" fill="#dccaa6" />
          <path d="M0 50H240M0 62H22V74H40V86H200V74H218V62H240" fill="none" stroke="#a8957a" strokeWidth="2" />
          <path d="M60 86L104 74H150" fill="none" stroke="#b8a483" strokeWidth="4" strokeLinecap="round" />
          <path d="M0 106Q120 98 240 108V150H0Z" fill="#c9ab7c" />
          <path d="M0 126Q120 118 240 128V150H0Z" fill="#b8996a" />
          {/* the gravel piles and a conveyor */}
          <g {...ol}>
            <path d="M168 112L220 88" fill="none" strokeWidth="5" />
            <path d="M196 120Q214 92 236 120Z" fill="#8e877d" />
            <path d="M150 122Q166 100 184 122Z" fill="#e0c79a" />
          </g>
          <g fill="#6e675e"><circle cx="210" cy="108" r="2.5" /><circle cx="220" cy="114" r="2" /><circle cx="204" cy="116" r="2" /></g>
          {/* the giant haul truck */}
          <g className="bob">
            <g {...ol}>
              <path d="M22 72h82l8 22H30z" fill="#f6b81f" />
              <path d="M104 72h24l6 8h-26z" fill="#e09a10" />
              <path d="M28 70q24-14 52-6 14 4 22 8z" fill="#bdb09a" />
              <rect x="106" y="82" width="34" height="18" rx="3" fill="#f6b81f" />
              <rect x="110" y="84" width="14" height="10" rx="2" fill="#9fe0ff" />
              <rect x="26" y="94" width="104" height="8" rx="2" fill="#3a3550" />
              <path d="M132 100v-14M140 100v-14" strokeWidth="2" />
              <circle cx="50" cy="110" r="18" fill="#2a2440" />
              <circle cx="50" cy="110" r="8" fill="#9b96b8" />
              <circle cx="116" cy="110" r="18" fill="#2a2440" />
              <circle cx="116" cy="110" r="8" fill="#9b96b8" />
            </g>
            <path d="M113 86l6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <rect {...ol} x="118" y="76" width="6" height="6" rx="2" fill="#ff7a2e" />
          </g>
        </svg>
      )
    },
  {
      to: '/recyclage' as const,
      title: 'Le Recyclage',
      text: "Le camion-poubelle, la grue des colonnes à verre, le centre de tri, l'aimant géant, la presse… et la bouteille redevient une bouteille !",
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="re-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfeec8" /><stop offset="1" stopColor="#f2fbe8" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#re-sky)" />
          <g fill="#fff"><ellipse cx="44" cy="26" rx="18" ry="6" /><ellipse cx="58" cy="21" rx="11" ry="7" /><ellipse cx="200" cy="34" rx="14" ry="5" /></g>
          <g {...ol}>
            <rect x="150" y="50" width="76" height="44" fill="#e8ecf0" /><rect x="150" y="76" width="76" height="18" fill="#2f8a50" />
            <path d="M144 50L188 30L232 50Z" fill="#6a7086" />
            <rect x="176" y="70" width="24" height="24" fill="#5a6070" />
            <path d="M166 40l6-6h8l-4 6M188 38l4 6-4 6M162 46h8" fill="none" />
          </g>
          <path d="M0 110Q120 102 240 112V150H0Z" fill="#73aa64" />
          <path d="M0 122H240V150H0Z" fill="#5d6070" />
          <path d="M0 136H240" stroke="#f3efe2" strokeWidth="3" strokeDasharray="14 10" />
          <g {...ol}>
            <path d="M22 108V92q0-12 13-12t13 12v16z" fill="#3a9a50" /><circle cx="30" cy="94" r="2.5" fill={INK} /><circle cx="40" cy="94" r="2.5" fill={INK} />
            <rect x="54" y="98" width="12" height="16" rx="2" fill="#3e4c48" /><rect x="52" y="94" width="16" height="5" rx="2" fill="#f4c21c" />
          </g>
          <g className="bob">
            <g {...ol}>
              <rect x="80" y="84" width="74" height="36" rx="8" fill="#f4f5f8" />
              <rect x="80" y="104" width="74" height="9" fill="#2fae55" />
              <path d="M80 88L70 96V120H80Z" fill="#dfe2ea" />
              <path d="M154 92h22q12 0 14 12v16h-36z" fill="#f4f5f8" />
              <rect x="166" y="96" width="16" height="11" rx="2" fill="#8ccaf0" />
              <rect x="104" y="78" width="10" height="6" rx="2" fill="#f4c21c" />
              <circle cx="98" cy="124" r="8" fill="#3a3550" /><circle cx="120" cy="124" r="8" fill="#3a3550" /><circle cx="172" cy="124" r="8" fill="#3a3550" />
              <circle cx="66" cy="104" r="5" fill="#f0c39a" /><rect x="62" y="108" width="8" height="10" rx="2" fill="#ff8f1f" />
            </g>
          </g>
        </svg>
      )
    },
  {
      to: '/port' as const,
      title: 'Le Port',
      text: 'Un grand port au bord de la mer : le porte-conteneurs, les remorqueurs, le portique géant, le cavalier, le camion, le train…',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="po-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd8ff" /><stop offset="1" stopColor="#e8f6ff" /></linearGradient>
            <linearGradient id="po-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a9ae8" /><stop offset="1" stopColor="#2f72c8" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#po-sky)" />
          <circle cx="34" cy="28" r="14" fill="#ffd65a" />
          <g fill="#fff"><ellipse cx="96" cy="22" rx="18" ry="6" /><ellipse cx="108" cy="17" rx="11" ry="7" /></g>
          {/* gulls */}
          <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round"><path d="M60 40q4-4 8 0q4-4 8 0" /><path d="M134 30q3-3 6 0q3-3 6 0" /></g>
          {/* the gantry crane on the quay */}
          <g {...ol}>
            <path d="M176 112V44M206 112V44" fill="none" stroke="#2f6fe0" strokeWidth="5" />
            <rect x="120" y="36" width="116" height="9" fill="#2f6fe0" />
            <path d="M186 36L194 14L202 36M194 14L128 36M194 14L232 36" fill="none" stroke="#2f6fe0" strokeWidth="3" />
            <rect x="214" y="24" width="20" height="12" rx="2" fill="#f4f5f8" />
            <rect x="140" y="45" width="12" height="8" rx="2" fill="#f2b21c" />
          </g>
          <path d="M146 53v18" stroke={INK} strokeWidth="2" />
          <rect {...ol} x="134" y="71" width="24" height="12" fill="#ee7a26" />
          <path d="M0 106Q60 100 120 106T240 104V150H0Z" fill="url(#po-sea)" />
          <rect x="164" y="104" width="76" height="46" fill="#b4b6c2" />
          <path d="M164 104H240" stroke="#f2b21c" strokeWidth="3" />
          <g fill="#fff" opacity=".7"><path d="M10 124h16M40 132h20M80 122h14M110 136h18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></g>
          <g className="bob">
            <g {...ol}>
              <path d="M8 96H160L150 118H18Z" fill="#1d3a7a" />
              <path d="M18 118H150L152 112H16Z" fill="#c0302a" />
              <rect x="14" y="62" width="22" height="34" fill="#f4f5f8" />
              <rect x="18" y="52" width="10" height="10" fill="#e5452c" />
              <rect x="44" y="82" width="22" height="14" fill="#d8402a" />
              <rect x="66" y="82" width="22" height="14" fill="#2f6fe0" />
              <rect x="88" y="82" width="22" height="14" fill="#f2b21c" />
              <rect x="110" y="82" width="22" height="14" fill="#3aa46a" />
              <rect x="44" y="68" width="22" height="14" fill="#1f9aa8" />
              <rect x="66" y="68" width="22" height="14" fill="#ee7a26" />
              <rect x="88" y="68" width="22" height="14" fill="#d8402a" />
            </g>
            <rect x="17" y="66" width="16" height="6" fill="#7fcdee" />
            <path d="M18 104h12M134 104h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          {/* a little tug pushing */}
          <g {...ol}>
            <path d="M2 124H34L30 134H6Z" fill="#d8302a" />
            <rect x="12" y="114" width="12" height="10" rx="2" fill="#f4f5f8" />
            <circle cx="34" cy="126" r="4" fill="#3a3550" />
          </g>
        </svg>
      )
    },
  {
      to: '/foret' as const,
      title: 'La Forêt',
      text: 'L’abatteuse, le porteur, le grumier, la scierie, la broyeuse… et la planteuse qui replante les arbres.',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="fo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8e6c8" /><stop offset="1" stopColor="#f0f8e0" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#fo-sky)" />
          <circle cx="200" cy="28" r="14" fill="#ffd65a" />
          <g fill="#fff"><ellipse cx="60" cy="24" rx="18" ry="7" /><ellipse cx="74" cy="19" rx="11" ry="8" /></g>
          {/* pines in the back */}
          <g {...ol} fill="#3a7a44">
            <path d="M150 104L166 52L182 104Z" /><path d="M176 104L194 40L212 104Z" /><path d="M204 104L220 58L236 104Z" />
            <path d="M8 98L22 56L36 98Z" />
          </g>
          <g fill="#2f6b3a"><path d="M194 52L186 78H202Z" /><path d="M166 64L160 84H172Z" /></g>
          <path d="M0 104Q60 92 130 100T240 98V150H0Z" fill="#9ccb6a" />
          <path d="M0 124Q90 114 170 122T240 120V150H0Z" fill="#7aa84e" />
          {/* stacked logs */}
          <g {...ol} fill="#e8c48a" strokeWidth="2">
            <circle cx="166" cy="116" r="7" /><circle cx="180" cy="116" r="7" /><circle cx="194" cy="116" r="7" /><circle cx="173" cy="104" r="7" /><circle cx="187" cy="104" r="7" />
          </g>
          <g fill="#b98345"><circle cx="166" cy="116" r="2" /><circle cx="180" cy="116" r="2" /><circle cx="194" cy="116" r="2" /><circle cx="173" cy="104" r="2" /><circle cx="187" cy="104" r="2" /></g>
          {/* a young tree */}
          <g {...ol}><path d="M218 132l7-20 7 20z" fill="#5aa040" /><path d="M225 132v6" /></g>
          <g className="bob">
            {/* the harvester: crane holding a log */}
            <path d="M62 84L84 44L126 58" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M62 84L84 44L126 58" fill="none" stroke="#f2b51c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <g {...ol}>
              <rect x="118" y="58" width="16" height="22" rx="4" fill="#f2b51c" />
              <rect x="104" y="78" width="54" height="10" rx="5" fill="#8a5a3a" />
              <circle cx="158" cy="83" r="5" fill="#e8c48a" />
              <rect x="22" y="94" width="96" height="20" rx="6" fill="#f2b51c" />
              <rect x="74" y="62" width="34" height="34" rx="5" fill="#f2b51c" />
              <rect x="80" y="67" width="22" height="20" rx="3" fill="#9fe0ff" />
              <rect x="26" y="84" width="40" height="12" rx="4" fill="#e0a010" />
              <circle cx="38" cy="118" r="11" fill="#3a3550" /><circle cx="80" cy="120" r="9" fill="#3a3550" /><circle cx="102" cy="120" r="9" fill="#3a3550" />
            </g>
            <path d="M84 72l12 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <g fill="#9b96b8"><circle cx="38" cy="118" r="4" /><circle cx="80" cy="120" r="3" /><circle cx="102" cy="120" r="3" /></g>
            <rect x="88" y="56" width="8" height="5" rx="2" fill="#ffa53a" />
          </g>
        </svg>
      )
    },
  {
      to: '/mer' as const,
      title: 'Sous la mer',
      text: 'Le sous-marin qui plonge, le robot au bout de son câble, le chalutier, l’éolienne en mer… et une baleine qui passe !',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="me-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe6ff" /><stop offset="1" stopColor="#e8f6ff" /></linearGradient>
            <linearGradient id="me-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4aa8e8" /><stop offset="1" stopColor="#1f5fae" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#me-sky)" />
          <g fill="#fff"><ellipse cx="40" cy="18" rx="16" ry="5" /><ellipse cx="52" cy="14" rx="10" ry="6" /></g>
          {/* the research ship on the surface */}
          <g {...ol}>
            <path d="M136 40h84l-8 12h-68z" fill="#1f3f86" />
            <rect x="184" y="26" width="26" height="14" rx="2" fill="#f4f5f8" />
            <rect x="190" y="18" width="16" height="8" rx="2" fill="#f4f5f8" />
            <path d="M144 40l8-22h4l-6 22" fill="none" stroke="#f4b81c" strokeWidth="3.5" />
          </g>
          <path d="M0 46Q15 42 30 46T60 46T90 46T120 46T150 46T180 46T210 46T240 46V150H0Z" fill="url(#me-sea)" />
          <path d="M154 46V92" stroke={INK} strokeWidth="2" />
          <g {...ol}><rect x="146" y="92" width="16" height="12" rx="3" fill="#b8bdc8" /></g>
          {/* the sea floor, coral and seaweed */}
          <path d="M0 126Q120 114 240 128V150H0Z" fill="#e2c890" />
          <g {...ol}>
            <path d="M200 128q-2-14 4-22M206 128q2-12 10-18M212 128q4-8 2-14" fill="none" stroke="#ff6a8a" strokeWidth="4" />
            <path d="M30 128q-6-20 2-36q6 16-2 36z" fill="#3f9a5a" />
            <path d="M22 128q-4-12 0-24q4 12 0 24z" fill="#5ab06a" />
            <path d="M60 106l18-6v12z" fill="#f2d24a" /><ellipse cx="86" cy="106" rx="10" ry="6" fill="#f2d24a" />
          </g>
          {/* the yellow submarine, bobbing */}
          <g className="bob">
            <path d="M150 86l60-14v34z" fill="#fff1b8" opacity=".55" />
            <g {...ol}>
              <path d="M84 86q0-16 26-16h18q22 0 24 16-2 14-24 14h-18q-26 0-26-14z" fill="#f4b81c" />
              <rect x="104" y="60" width="18" height="10" rx="3" fill="#f4b81c" />
              <path d="M84 80l-12-8v26l12-8z" fill="#f06a26" />
              <circle cx="138" cy="90" r="9" fill="#f4f5f8" />
              <circle cx="141" cy="90" r="4" fill="#7fd0ff" />
              <circle cx="112" cy="82" r="4" fill="#7fd0ff" /><circle cx="124" cy="82" r="4" fill="#7fd0ff" />
              <rect x="96" y="100" width="40" height="4" rx="2" fill="#9aa4b6" />
            </g>
            <g fill="none" stroke="#fff" strokeWidth="2" opacity=".85"><circle cx="112" cy="50" r="3" /><circle cx="118" cy="40" r="4" /><circle cx="112" cy="30" r="2.5" /></g>
          </g>
        </svg>
      )
    },
  {
      to: '/montagne' as const,
      title: 'La Montagne',
      text: 'La dameuse qui lisse la piste, le télésiège, la télécabine, le canon à neige, la motoneige, l’hélicoptère de secours…',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="mo-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9cc4f0" /><stop offset="1" stopColor="#e8f1fb" /></linearGradient>
            <linearGradient id="mo-snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f7fd" /><stop offset="1" stopColor="#d8e2f4" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#mo-sky)" />
          <g {...ol}>
            <path d="M-6 104L60 30L102 78L148 20L246 104Z" fill="#8e98b6" />
            <path d="M60 30L46 46l8 5 6-7 7 8 9-6zM148 20l-17 19 10 5 7-8 8 8 12-5z" fill="#f4f7fd" />
          </g>
          <path d="M24 16L236 78" stroke={INK} strokeWidth="2" />
          <g {...ol}>
            <rect x="200" y="67" width="7" height="46" fill="#9aa3b4" />
            <path d="M190 69h27" fill="none" />
            <path d="M112 40v16q0 5-5 5H94" fill="none" />
            <rect x="88" y="58" width="22" height="6" rx="3" fill="#2f62d8" />
            <rect x="86" y="44" width="6" height="18" rx="3" fill="#2f62d8" />
          </g>
          <g fill="#fff"><circle cx="20" cy="40" r="2.5" /><circle cx="186" cy="34" r="2" /><circle cx="214" cy="20" r="2.5" /><circle cx="128" cy="12" r="2" /><circle cx="40" cy="70" r="2" /></g>
          <path d="M0 104Q120 92 240 106V150H0Z" fill="url(#mo-snow)" />
          <path d="M0 126Q120 118 240 128V150H0Z" fill="#dfe7f6" />
          <path d="M0 132h66M0 138h60M0 144h68" stroke="#bccbe8" strokeWidth="2" />
          <g {...ol}>
            <path d="M14 116l11-30 11 30z" fill="#2c6e4e" /><path d="M18 102l7-16 7 16-7-3z" fill="#f4f7fd" />
            <path d="M210 118l12-34 12 34z" fill="#25664a" /><path d="M215 102l7-18 7 18-7-3z" fill="#f4f7fd" />
          </g>
          <g className="bob">
            <g {...ol}>
              <rect x="72" y="106" width="88" height="20" rx="10" fill="#3a3c48" />
              <g fill="#b6bbc8"><circle cx="85" cy="116" r="5" /><circle cx="103" cy="116" r="5" /><circle cx="121" cy="116" r="5" /><circle cx="139" cy="116" r="5" /></g>
              <path d="M76 106V91h40l5-19h26l8 34z" fill="#d62a2a" />
              <path d="M125 77h17l4 20h-24z" fill="#9fd2ef" />
              <rect x="118" y="65" width="32" height="6" rx="3" fill="#2a2e3a" />
              <circle cx="126" cy="61" r="3.5" fill="#ffa53a" />
              <path d="M162 84q15 4 19 42h-13q-2-32-10-36z" fill="#d62a2a" />
              <rect x="48" y="106" width="26" height="15" rx="6" fill="#a31e22" />
              <path d="M40 124h30" fill="none" />
            </g>
          </g>
        </svg>
      )
    },
  {
      to: '/secours' as const,
      title: 'Les Secours',
      text: 'La caserne, la police et l’hôpital : la grande échelle, le fourgon pompe, les ambulances, la moto, l’hélicoptère Dragon, le bateau…',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="se-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd4ff" /><stop offset="1" stopColor="#e8f5ff" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#se-sky)" />
          <g fill="#fff"><ellipse cx="48" cy="24" rx="18" ry="7" /><ellipse cx="62" cy="19" rx="11" ry="7" /></g>
          {/* the fire station: training tower, brick hall with its big red doors */}
          <g {...ol}>
            <rect x="206" y="22" width="22" height="86" fill="#d8302a" />
            <rect x="212" y="32" width="10" height="10" fill="#2a2f40" /><rect x="212" y="54" width="10" height="10" fill="#2a2f40" /><rect x="212" y="76" width="10" height="10" fill="#2a2f40" />
            <rect x="128" y="50" width="80" height="58" fill="#c4583a" />
            <rect x="124" y="46" width="88" height="8" fill="#e9dcc4" />
            <rect x="136" y="72" width="28" height="36" fill="#d8302a" /><rect x="172" y="72" width="28" height="36" fill="#d8302a" />
            <path d="M136 82h28M136 92h28M172 82h28M172 92h28" strokeWidth="1.5" />
            <rect x="144" y="58" width="48" height="9" rx="2" fill="#fff" />
          </g>
          <path d="M150 62.5h36" stroke="#d8302a" strokeWidth="3" strokeLinecap="round" />
          <g {...ol}>
            <rect x="14" y="40" width="7" height="68" fill="#8a5a3a" />
            <circle cx="17" cy="32" r="19" fill="#5aa85a" />
            <circle cx="94" cy="44" r="13" fill="#4a9a4a" />
            <rect x="91" y="56" width="6" height="52" fill="#8a5a3a" />
          </g>
          <path d="M0 108H240V150H0Z" fill="#8a8ea0" />
          <path d="M0 124H240" stroke="#f3efe2" strokeWidth="3" strokeDasharray="14 10" />
          <path d="M0 106Q60 100 120 106V112H0Z" fill="#8cc46a" />
          <g className="bob">
            <g {...ol}>
              {/* ladder raised towards a little cat */}
              <path d="M62 92L50 46" fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
              <path d="M62 92L50 46" fill="none" stroke="#dfe3ea" strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="40" cy="38" rx="6" ry="4.5" fill="#f0922a" />
              <circle cx="45" cy="33" r="4" fill="#f0922a" />
              <rect x="30" y="38" width="24" height="12" rx="2" fill="#d8302a" />
              <rect x="22" y="96" width="92" height="24" rx="4" fill="#d8302a" />
              <rect x="114" y="82" width="38" height="38" rx="6" fill="#d8302a" />
              <rect x="126" y="88" width="20" height="14" rx="3" fill="#9fe0ff" />
              <rect x="122" y="76" width="22" height="6" rx="2" fill="#3a6aff" />
              <rect x="30" y="102" width="20" height="12" rx="2" fill="#c9ced8" /><rect x="56" y="102" width="20" height="12" rx="2" fill="#c9ced8" /><rect x="82" y="102" width="20" height="12" rx="2" fill="#c9ced8" />
              <circle cx="50" cy="124" r="11" fill="#3a3550" /><circle cx="132" cy="124" r="11" fill="#3a3550" />
              <circle cx="50" cy="124" r="4" fill="#c9ced8" /><circle cx="132" cy="124" r="4" fill="#c9ced8" />
              <circle cx="62" cy="92" r="7" fill="#8e141c" />
            </g>
            <path d="M22 116H152" stroke="#f2d21c" strokeWidth="3" />
          </g>
        </svg>
      )
    },
  {
      to: '/travaux' as const,
      title: 'La Route',
      text: 'On refait la rue du village : la raboteuse, la balayeuse, le finisseur tout chaud, les compacteurs, la traceuse… et le signaleur qui fait passer les voitures.',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="tr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3ff" /><stop offset="1" stopColor="#fdf3dc" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#tr-sky)" />
          <circle cx="206" cy="28" r="15" fill="#fff4d2" />
          <g fill="#fff" opacity=".9"><ellipse cx="60" cy="24" rx="18" ry="6" /><ellipse cx="74" cy="19" rx="11" ry="7" /></g>
          {/* the village behind the road */}
          <g {...ol}>
            <rect x="8" y="58" width="34" height="36" fill="#f1e6d2" /><path d="M4 60L25 40L46 60Z" fill="#c0583a" />
            <rect x="16" y="66" width="8" height="10" fill="#2c3e5a" /><rect x="28" y="78" width="8" height="16" fill="#6b3b2a" />
            <rect x="150" y="62" width="30" height="32" fill="#e9d6b4" /><path d="M146 64L165 46L184 64Z" fill="#5a6070" />
            <rect x="157" y="70" width="7" height="9" fill="#2c3e5a" /><rect x="168" y="70" width="7" height="9" fill="#2c3e5a" />
            <rect x="196" y="40" width="16" height="54" fill="#d8ccb0" /><path d="M192 42L204 14L216 42Z" fill="#5a6070" />
          </g>
          <path d="M0 96H240V150H0Z" fill="#8fb56a" />
          {/* the road: old and cracked on the right, new and black with white lines on the left */}
          <path d="M0 104H240V134H0Z" fill="#8a8a92" />
          <path d="M0 104H112V134H0Z" fill="#33343c" />
          <g stroke="#55565e" strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M150 112l8 4 4 8M190 108l-6 6 6 6 -4 8M214 122l10-4" /></g>
          <g stroke="#fff" strokeWidth="3"><path d="M6 119h14M32 119h14M58 119h14M84 119h14" /></g>
          <path d="M0 104H240M0 134H240" stroke={INK} strokeWidth="2.5" />
          {/* cones */}
          <g {...ol} fill="#f06a2a"><path d="M128 102l4-14 4 14z" /><path d="M224 102l4-14 4 14z" /></g>
          <g fill="#fff"><rect x="129.5" y="93" width="5" height="3" /><rect x="225.5" y="93" width="5" height="3" /></g>
          {/* the flagger with his K10 paddle */}
          <g {...ol}>
            <path d="M210 82v22" /><circle cx="210" cy="78" r="7" fill="#e5452c" />
            <rect x="194" y="84" width="10" height="18" rx="3" fill="#ff8f1f" /><circle cx="199" cy="78" r="5" fill="#f0c39a" />
            <path d="M193 77a6 5 0 0 1 12 0z" fill="#ffd23a" />
          </g>
          {/* the paver, laying hot asphalt */}
          <g className="bob">
            <g fill="#fff" opacity=".85"><circle cx="40" cy="98" r="4" /><circle cx="50" cy="92" r="5" /><circle cx="44" cy="84" r="4" /></g>
            <g {...ol}>
              <rect x="56" y="104" width="22" height="12" rx="2" fill="#f6c419" />
              <rect x="70" y="86" width="58" height="20" rx="4" fill="#f6c419" />
              <path d="M126 88l26-12v28h-26z" fill="#cf9a10" />
              <path d="M80 86V60M118 86V60" /><rect x="74" y="56" width="50" height="6" rx="2" fill="#f4f5f8" />
              <rect x="74" y="106" width="56" height="16" rx="8" fill="#2e323e" />
              <g fill="#aab2be"><circle cx="84" cy="114" r="4" /><circle cx="102" cy="114" r="4" /><circle cx="120" cy="114" r="4" /></g>
              <circle cx="98" cy="74" r="6" fill="#f0c39a" /><path d="M92 73a6 5 0 0 1 12 0z" fill="#ffd23a" />
            </g>
          </g>
        </svg>
      )
    },
  {
      to: '/livraison' as const,
      title: 'Le Colis',
      text: "Suis le cadeau de Léo : le camion au quai, le transpalette, les robots de l'entrepôt, la trieuse, la camionnette, le vélo cargo, le drone et le petit robot livreur…",
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="livraison-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8dcff" /><stop offset="1" stopColor="#fff1d8" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#livraison-sky)" />
          <g fill="#fff"><ellipse cx="44" cy="26" rx="18" ry="6" /><ellipse cx="58" cy="21" rx="11" ry="7" /></g>
          {/* the drone bringing a little parcel */}
          <g {...ol}>
            <path d="M92 22h52" /><path d="M96 16h12M128 16h12" strokeWidth="2" />
            <path d="M106 22h24l-3 8h-18z" fill="#f4f5f8" />
            <path d="M118 30v14" strokeWidth="1.5" />
            <rect x="111" y="44" width="14" height="12" rx="2" fill="#c99a5e" />
          </g>
          {/* Léo's house: pink walls, red roof, the open door and Léo with his teddy */}
          <g {...ol}>
            <rect x="164" y="58" width="62" height="52" fill="#f2d4c8" />
            <path d="M158 60l37-28 37 28z" fill="#c4583a" />
            <rect x="172" y="68" width="14" height="14" fill="#2a3f58" /><rect x="206" y="68" width="14" height="14" fill="#2a3f58" />
            <rect x="190" y="84" width="16" height="26" fill="#2a2f40" />
            <path d="M190 84l-8 4v26l8-4z" fill="#1f3a7a" />
            <circle cx="198" cy="94" r="5" fill="#f0c39a" />
            <rect x="193" y="99" width="10" height="11" rx="3" fill="#f2b21c" />
            <circle cx="208" cy="102" r="4" fill="#a8703c" /><circle cx="208" cy="96" r="3.5" fill="#a8703c" />
          </g>
          <path d="M0 110H240V150H0Z" fill="#8a8ea0" />
          <path d="M0 128H240" stroke="#f3efe2" strokeWidth="3" strokeDasharray="14 10" />
          <path d="M0 106Q60 100 120 106L160 108H240V112H0Z" fill="#8cc46a" />
          {/* the little sidewalk robot with its orange flag */}
          <g {...ol}>
            <path d="M146 82v24" strokeWidth="2" />
            <path d="M146 82l10 3-10 3z" fill="#f2781c" />
            <rect x="140" y="100" width="28" height="12" rx="4" fill="#f4f5f8" />
            <circle cx="145" cy="114" r="3" fill="#2a2f40" /><circle cx="154" cy="114" r="3" fill="#2a2f40" /><circle cx="163" cy="114" r="3" fill="#2a2f40" />
          </g>
          <g className="bob">
            <g {...ol}>
              {/* the delivery van */}
              <path d="M14 76h76q6 0 10 4l16 16q10 2 12 8v18H14z" fill="#f4f5f8" />
              <path d="M92 82l14 14H92z" fill="#2a3f58" />
              <rect x="14" y="104" width="114" height="6" fill="#f2781c" />
              <rect x="24" y="86" width="40" height="10" rx="2" fill="#1f3a7a" />
              <rect x="70" y="84" width="14" height="12" rx="2" fill="#c99a5e" />
              <circle cx="34" cy="124" r="10" fill="#3a3550" /><circle cx="34" cy="124" r="4" fill="#c9ced8" />
              <circle cx="104" cy="124" r="10" fill="#3a3550" /><circle cx="104" cy="124" r="4" fill="#c9ced8" />
            </g>
          </g>
        </svg>
      )
    },
  {
      to: '/garage' as const,
      title: 'Le Garage',
      text: 'La voiture est en panne ! La dépanneuse, le pont élévateur, les pneus, la vidange, la batterie, le lavage et la station-service…',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="ga-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a8d8ff" /><stop offset="1" stopColor="#eef7ff" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#ga-sky)" />
          <g fill="#fff"><ellipse cx="40" cy="24" rx="17" ry="6" /><ellipse cx="54" cy="19" rx="10" ry="6" /></g>
          {/* the garage, open in front: the car up on the blue lift */}
          <g {...ol}>
            <rect x="126" y="40" width="108" height="70" fill="#f0e6d4" />
            <rect x="122" y="34" width="116" height="10" fill="#2f5fc8" />
            <rect x="150" y="16" width="60" height="16" rx="3" fill="#2f5fc8" />
            <rect x="138" y="54" width="84" height="56" fill="#c8c4b8" />
            <rect x="146" y="56" width="7" height="54" fill="#2f6fd8" /><rect x="207" y="56" width="7" height="54" fill="#2f6fd8" />
            <path d="M156 82q2-7 10-8l8-1 7-7h16l8 7h4q5 1 5 7v4h-58z" fill="#d83a2a" />
            <circle cx="168" cy="88" r="5" fill="#2a2f40" /><circle cx="200" cy="88" r="5" fill="#2a2f40" />
            <path d="M153 90h12M207 90h-10" strokeWidth="3" />
          </g>
          <path d="M162 24h36" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <g {...ol}>
            <rect x="18" y="56" width="7" height="54" fill="#8a5a3a" />
            <circle cx="21" cy="48" r="17" fill="#5aa85a" />
          </g>
          <path d="M0 108H240V150H0Z" fill="#8a8ea0" />
          <path d="M0 132H240" stroke="#f3efe2" strokeWidth="3" strokeDasharray="14 10" />
          <path d="M0 106Q60 101 120 107V112H0Z" fill="#8cc46a" />
          <g className="bob">
            <g {...ol}>
              {/* the flatbed tow truck carrying the family car */}
              <rect x="20" y="104" width="86" height="8" rx="2" fill="#f2781c" />
              <rect x="104" y="80" width="30" height="36" rx="5" fill="#f3f4f7" />
              <rect x="114" y="85" width="16" height="12" rx="2" fill="#9fe0ff" />
              <rect x="108" y="74" width="20" height="6" rx="2" fill="#f6b21a" />
              <rect x="20" y="112" width="114" height="8" rx="2" fill="#2a2f40" />
              <path d="M28 96q0-7 7-8l11-1 10-9h22l10 9h5q6 1 6 8v9H28z" fill="#d83a2a" />
              <path d="M58 81h8v6H51zM70 81h7l8 6H70z" fill="#9fe0ff" />
              <circle cx="42" cy="104" r="5.5" fill="#2a2f40" /><circle cx="82" cy="104" r="5.5" fill="#2a2f40" />
              <circle cx="38" cy="124" r="9" fill="#2a2f40" /><circle cx="60" cy="124" r="9" fill="#2a2f40" /><circle cx="120" cy="124" r="9" fill="#2a2f40" />
              <circle cx="38" cy="124" r="3.5" fill="#c9ced8" /><circle cx="60" cy="124" r="3.5" fill="#c9ced8" /><circle cx="120" cy="124" r="3.5" fill="#c9ced8" />
            </g>
          </g>
        </svg>
      )
    },
  {
      to: '/rail' as const,
      title: 'Le Chemin de fer',
      text: 'Le TGV et sa caténaire, le train de fret, l’aiguillage, le passage à niveau, la bourreuse, la vieille locomotive à vapeur…',
      art: (
        <svg viewBox="0 0 240 150" aria-hidden="true">
          <defs>
            <linearGradient id="rail-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3f6" /><stop offset="1" stopColor="#f3f7e4" /></linearGradient>
          </defs>
          <rect width="240" height="150" fill="url(#rail-sky)" />
          <g fill="#fff"><ellipse cx="54" cy="22" rx="16" ry="5" /><ellipse cx="66" cy="18" rx="10" ry="6" /></g>
          {/* the stone viaduct in the distance, between two green hills */}
          <path d="M-10 74Q20 40 54 74Z" fill="#8cc06a" />
          <path d="M186 74Q216 36 250 74Z" fill="#8cc06a" />
          <path d="M30 50H206V74H196Q196 62 186 62Q176 62 176 74H164Q164 62 154 62Q144 62 144 74H132Q132 62 122 62Q112 62 112 74H100Q100 62 90 62Q80 62 80 74H68Q68 62 58 62Q48 62 48 74H30Z" fill="#e2d6bc" />
          <rect x="30" y="47" width="176" height="4" fill="#c9b998" />
          <path d="M0 74H240V150H0Z" fill="#a8d277" />
          {/* catenary: masts and the wire */}
          <g {...ol}>
            <rect x="22" y="40" width="5" height="64" fill="#9aa3ad" /><rect x="192" y="40" width="5" height="64" fill="#9aa3ad" />
            <path d="M27 46H40M197 46H210" fill="none" />
          </g>
          <path d="M0 52H240" stroke={INK} strokeWidth="2" />
          <path d="M0 44Q60 50 120 44T240 44" fill="none" stroke={INK} strokeWidth="1.2" />
          {/* ballast and rails */}
          <path d="M-4 112H244L236 124H4Z" fill="#9a9488" />
          <path d="M0 112H240" stroke="#6a6f7a" strokeWidth="3" />
          <g className="bob">
            <path d="M80 76L96 60L82 52" fill="none" stroke="#5a5f6c" strokeWidth="3" strokeLinejoin="round" />
            <rect x="72" y="52" width="22" height="3" rx="1" fill="#c07a3a" />
            <path {...ol} d="M6 106V80Q6 74 13 74H160Q200 74 226 98L228 106Z" fill="#f4f5f8" />
            <path d="M7 98H222L225 102H7Z" fill="#a8183c" />
            <path d="M170 77Q196 80 212 92L174 92Z" fill="#2a3f58" />
            <g fill="#2a3f58">
              <rect x="16" y="79" width="12" height="7" rx="2" /><rect x="34" y="79" width="12" height="7" rx="2" /><rect x="52" y="79" width="12" height="7" rx="2" />
              <rect x="100" y="79" width="12" height="7" rx="2" /><rect x="118" y="79" width="12" height="7" rx="2" /><rect x="136" y="79" width="12" height="7" rx="2" />
              <rect x="16" y="89" width="12" height="6" rx="2" /><rect x="34" y="89" width="12" height="6" rx="2" /><rect x="52" y="89" width="12" height="6" rx="2" />
              <rect x="100" y="89" width="12" height="6" rx="2" /><rect x="118" y="89" width="12" height="6" rx="2" /><rect x="136" y="89" width="12" height="6" rx="2" />
            </g>
            <path {...ol} d="M82 74v32M156 74v32" fill="none" strokeWidth="1.5" />
            <g {...ol} fill="#3f424a"><circle cx="24" cy="108" r="5" /><circle cx="40" cy="108" r="5" /><circle cx="196" cy="108" r="5" /><circle cx="212" cy="108" r="5" /></g>
            <circle cx="220" cy="99" r="2.5" fill="#fff3c8" />
          </g>
          {/* a level-crossing sign and a cow watching the train */}
          <g {...ol}>
            <rect x="16" y="118" width="4" height="28" fill="#f4f5f8" />
            <path d="M6 112l24 14M30 112L6 126" stroke="#d8302a" strokeWidth="6" />
            <path d="M6 112l24 14M30 112L6 126" stroke="#fff" strokeWidth="2.5" />
            <circle cx="12" cy="132" r="4" fill="#ff3a2a" /><circle cx="24" cy="132" r="4" fill="#4a1a1a" />
            <rect x="178" y="122" width="34" height="16" rx="7" fill="#f6f2ea" />
            <rect x="182" y="136" width="4" height="10" fill="#f6f2ea" /><rect x="204" y="136" width="4" height="10" fill="#f6f2ea" />
            <rect x="164" y="116" width="16" height="13" rx="5" fill="#f6f2ea" />
            <rect x="160" y="122" width="8" height="7" rx="3" fill="#f0a8a0" />
          </g>
          <g fill="#7a4a2a"><ellipse cx="196" cy="128" rx="6" ry="4" /><circle cx="173" cy="120" r="3" /></g>
          <circle cx="170" cy="121" r="1.4" fill={INK} />
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
