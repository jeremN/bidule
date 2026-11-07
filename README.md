# Bidule

Des machines en 3D qu'on fait fonctionner pour comprendre comment marchent les choses. Pour les petits, dès la maternelle.

Chaque « monde » est un petit diorama en 3D avec six machines. L'enfant en touche une, une voix lui dit à quoi elle sert, puis il appuie sur le gros bouton et la regarde travailler étape par étape. À chaque étape, la pièce qui bouge s'allume (le vérin, le godet, la charrue…) et la voix explique ce qui se passe.

| Monde | Machines |
| --- | --- |
| **Le Chantier** | pelleteuse, camion-benne, bulldozer, grue à tour, camion toupie, rouleau compresseur |
| **La Ferme** | tracteur + charrue, semoir, pulvérisateur, moissonneuse-batteuse, presse à balles, chariot télescopique |

L'idée de départ vient de [os-taxonomy de Marble](https://github.com/withmarbleapp/os-taxonomy), un graphe des notions du primaire avec leurs prérequis. À terme, chaque monde pourra être rattaché aux notions du programme français (maternelle → lycée).

## Démarrer

Il faut **Node 26** (LTS, voir `.nvmrc`).

```bash
nvm use          # ou fnm use
npm install
npm run dev      # http://localhost:3000
npm run build    # site statique prérendu dans dist/client
npm run check    # eslint + TypeScript
```

L'app est construite avec [TanStack Start](https://tanstack.com/start) (React) en **prérendu statique** : chaque page (`/`, `/chantier`, `/ferme`) est générée en HTML au build, puis la navigation se fait côté client.
Le moteur 3D est chargé uniquement dans le navigateur (import dynamique dans `WorldStage`), il ne tourne jamais pendant le prérendu.

Pour tester vite dans un navigateur lent (rendu logiciel, CI), ajoute `?fast` à l'URL d'un monde : les animations avancent par grands pas.

## Déploiement

Chaque push sur `main` lance `.github/workflows/pages.yml` : vérifs, build avec `BASE_PATH=/bidule/`, puis publication de `dist/client` sur **GitHub Pages** (source *GitHub Actions* dans *Settings → Pages*).

## Organisation

```
vite.config.ts        TanStack Start + prérendu, BASE_PATH pour GitHub Pages
src/
  router.tsx          création du routeur
  routes/
    __root.tsx        document HTML, polices, CSS
    index.tsx         accueil (choix du monde)
    chantier.tsx      /chantier
    ferme.tsx         /ferme
  components/
    WorldStage.tsx    monte un monde 3D dans la page et le nettoie en sortant
  kit/                moteur 3D, sans framework
    stage.js          scène, rendu « technicolour », caméra, interface, boucle ; createStage() → dispose()
    geo.js            matériaux et primitives (boîtes arrondies, profils extrudés…)
    parts.js          pièces mécaniques : chenilles, pneus, vérins, cabines, conducteurs
    props.js          décor : arbres, lampadaires, grange, silo, clôtures…
    tween.js          petit moteur d'animation à base de promesses
    audio.js          voix (synthèse vocale fr-FR) et bruitages (WebAudio)
  worlds/
    chantier.js       les six engins de chantier
    ferme.js          les six machines agricoles
```

## Ajouter un monde

Un monde est un module dans `src/worlds/` qui décrit :

- `data` : pour chaque machine, son nom, le verbe du bouton (« Creuser »), à quoi elle sert (`use`) et comment elle marche (`how`) ;
- `cfg` : où elle est posée sur l'île ;
- `icons` : son pictogramme SVG pour la barre du bas ;
- `build(ctx)` : construit le décor et les machines. Chaque machine définit `action()`, une suite d'étapes :

```js
await Promise.all([
  step('Les vérins font descendre le bras.', 'verins'), // phrase lue + pièce surlignée
  poseTo({ boom: -5, stick: -55 }, 1.7)                  // l'animation qui va avec
]);
```

Les vérins (`hydraulic`, `telescopic`) se recalculent seuls entre leurs deux points d'accroche : il suffit de faire bouger les pièces, les vérins suivent.

Puis une route dans `src/routes/` (copier `ferme.tsx`) et une carte sur l'accueil (`routes/index.tsx`).

## Technique

- [TanStack Start](https://tanstack.com/start) + React 19, Vite 8, Node 26.
- [three.js](https://threejs.org) r128 pour la 3D, sans surcouche.
- Aucun modèle 3D externe : tout est construit en code (profils extrudés, pièces instanciées). Ça permet d'animer chaque pièce séparément.

## Idées pour la suite

- D'autres mondes : le cycle de l'eau, le corps humain, les volcans, l'espace…
- Relier chaque étape aux notions du programme (cycle 1, 2, 3…).
- Passer l'interface des mondes (fiche, barre d'engins) en composants React.
- Monter de version de three.js (r128 → actuel : gestion des couleurs et de la lumière à recalibrer).
