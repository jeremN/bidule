# Bidule

Des machines en 3D qu'on fait fonctionner pour comprendre comment marchent les choses. Pour les petits, dès la maternelle.

Chaque « monde » est un petit diorama vivant en 3D, dans un style de dessin animé : un vrai quartier en construction, une grande ferme, une ville, une base spatiale. Les voitures roulent, les gens se promènent, les animaux broutent. L'enfant touche une machine : la caméra va la voir, une voix lui dit à quoi elle sert, puis il appuie sur le gros bouton et la regarde travailler étape par étape. À chaque étape, la pièce qui bouge est signalée par une bulle (le vérin, le godet, la charrue…) et la voix explique ce qui se passe. Les bulles peuvent être cachées avec le bouton en forme de bulle.

| Monde | Machines |
| --- | --- |
| **Le Chantier** | pelleteuse, camion-benne, tractopelle, dumper, chargeuse, grue à tour, pompe à béton, camion toupie, nacelle, et toute la route : bulldozer, niveleuse, rouleau compresseur, finisseur + rouleau tandem |
| **La Ferme** | épandeur à fumier, tracteur + charrue, semoir, pulvérisateur, moissonneuse-batteuse, faucheuse, andaineur, presse à balles, enrubanneuse, chariot télescopique |
| **La Ville** (japonaise) | voiture, car, camion-poubelle, camion de pompiers, tramway, métro, bateau-bus, Shinkansen, téléphérique |
| **L'Espace** | transporteur à chenilles, bus des astronautes, fusée, navette spatiale, station spatiale, capsule, rover martien, module lunaire |
| **L'Aéroport** | avion de ligne (décollage), petit avion à hélice (atterrissage), tracteur pushback, passerelle, tapis à bagages, camion avitailleur, camion traiteur, pompiers d'aéroport |
| **La Base militaire** | char, char poseur de pont, véhicule amphibie, camion de transport, hélicoptère, drone, avion de chasse, avion de transport (sans combat : on montre comment ils roulent, traversent, volent et transportent) |
| **L'Usine** | pont roulant, presse, robots soudeurs, cabine de peinture, chaîne de montage, robot AGV, chariot élévateur, porte-voitures (on suit une voiture de la bobine d'acier jusqu'au camion) |
| **La Carrière** | foreuse, brise-roche, grosse pelle, tombereau, concasseur, crible, chargeuse, arroseuse (de la roche au gravier qui part pour le chantier) |
| **Le Recyclage** | camion-poubelle, camion grue du verre, centre de tri, aimant géant, presse à balles, chariot élévateur, grue à grappin, broyeur de branches (ce que deviennent nos poubelles) |
| **Le Port** | porte-conteneurs, bateau-pilote, remorqueur, portique, cavalier, chariot porte-conteneurs, camion, train (un conteneur voyage du bateau jusqu'au train) |
| **La Forêt** | abatteuse, porteur, grumier, scierie, broyeuse, planteuse, camion de pompiers forestiers (de l'arbre à la planche, et on replante) |
| **Sous la mer** | navire océanographique, sous-marin de recherche, robot sous-marin, sous-marin, chalutier, câblier, éolienne en mer, plongeur (au-dessus et au fond de l'eau) |

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

L'app est construite avec [TanStack Start](https://tanstack.com/start) (React) en **prérendu statique** : chaque page (`/`, `/chantier`, `/ferme`, `/ville`, `/espace`, `/aeroport`, `/militaire`, `/usine`, `/carriere`, `/recyclage`, `/port`, `/foret`, `/mer`) est générée en HTML au build, puis la navigation se fait côté client.
Le moteur 3D est chargé uniquement dans le navigateur (import dynamique dans `WorldStage`), il ne tourne jamais pendant le prérendu.

Pour tester vite dans un navigateur lent (rendu logiciel, CI), ajoute `?fast` à l'URL d'un monde : les animations avancent par grands pas. `?noink` coupe les contours, `?debug` expose `window.__bidule` (renderer, scène) pour mesurer.

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
    chantier.tsx      /chantier   (idem ferme, ville, espace)
  components/
    WorldStage.tsx    monte un monde 3D dans la page et le nettoie en sortant
  kit/                moteur 3D, sans framework
    stage.js          scène, rendu dessin animé (aplats + contours), caméra qui pivote vers chaque engin, interface, boucle
    geo.js            matériaux « toon », primitives (boîtes arrondies, profils extrudés…), freeze() qui fusionne le décor fixe
    life.js           la vie autour : chemins, piétons, petites voitures, circulation qui s'arrête pour les autres
    fx.js             feu, fumée, poussière
    aircraft.js       avions et hélicoptère (avion de ligne, à hélice, de chasse, de transport)
    parts.js          pièces mécaniques : chenilles, pneus, vérins, cabines, conducteurs
    props.js          décor : arbres, lampadaires, grange, silo, clôtures…
    tween.js          petit moteur d'animation à base de promesses
    audio.js          voix (synthèse vocale fr-FR) et bruitages (WebAudio)
  worlds/
    chantier.js       le quartier en construction
    ferme.js          la grande ferme
    ville.js          la ville japonaise
    espace.js         la base spatiale
    aeroport.js       l'aéroport
    militaire.js      la base militaire
    usine.js          l'usine de voitures
    carriere.js       la carrière
    recyclage.js      le recyclage
    port.js           le port
    foret.js          la forêt
    mer.js            sous la mer
```

## Ajouter un monde

Un monde est un module dans `src/worlds/` qui décrit :

- `data` : pour chaque machine, son nom, le verbe du bouton (« Creuser »), à quoi elle sert (`use`) et comment elle marche (`how`) ;
- `cfg` : où elle est posée (et dans quel sens : la caméra se met de profil) ;
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
- Style : matériaux PBR et une passe d'étalonnage « technicolor » (grain, demi-teintes, vignettage). Les contours à l'encre restent disponibles avec `?ink`.

## Idées pour la suite

- D'autres mondes : le cycle de l'eau, le corps humain, les volcans…
- Relier chaque étape aux notions du programme (cycle 1, 2, 3…).
- Passer l'interface des mondes (fiche, barre d'engins) en composants React.
- Monter de version de three.js (r128 → actuel : gestion des couleurs et de la lumière à recalibrer).
