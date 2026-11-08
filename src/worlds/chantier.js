// Le Chantier — a whole neighbourhood being built: the earthworks, a block of flats going up with the crane,
// a new street with its houses, and the site base. Each machine works where it would on a real site.
import * as THREE from 'three';
import { V3, rad, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, thud, ding } from '../kit/audio.js';
import { C, MT, UB, ICO, dummy, tmpCol, mat, std, add, box, grp, cylGeo, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, arc, anchor, beam, pile, wp, shadows, instanced, toonMat } from '../kit/geo.js';
import { trackUnit, tire, fender, hydraulic, telescopic, strut, beacon, operator, worker, truckCab } from '../kit/parts.js';
import { autumnTree, lamp, cone, barrier, office, pipes } from '../kit/props.js';
import { route, person, miniCar, traffic } from '../kit/life.js';
import { createFx } from '../kit/fx.js';

const DATA={
  pelleteuse:{short:'La pelleteuse',full:'La pelleteuse',verb:'Creuser',horn:'horn',
    use:'Elle creuse des trous dans la terre.',
    how:"Des vérins poussent son bras, comme tes muscles. Au bout, le godet est une grosse cuillère."},
  camion:{short:'Le camion-benne',full:'Le camion-benne',verb:'Vider',horn:'horn',
    use:'Il transporte la terre et les cailloux.',
    how:"Pour le vider, un grand vérin s'allonge et lève la benne. La porte s'ouvre toute seule."},
  dumper:{short:'Le dumper',full:'Le dumper',verb:'Basculer',horn:'horn',
    use:'Il transporte les cailloux partout sur le chantier.',
    how:"Sa benne est devant le conducteur. Pour la vider, elle bascule vers l'avant."},
  chargeuse:{short:'La chargeuse',full:'La chargeuse',verb:'Charger',horn:'horn',
    use:'Elle ramasse les cailloux et remplit les camions.',
    how:'Elle fonce dans le tas avec son gros godet, le lève très haut, puis le vide dans la benne.'},
  bulldozer:{short:'Le bulldozer',full:'Le bulldozer',verb:'Pousser',horn:'horn',
    use:'Il pousse la terre pour faire la place de la nouvelle route.',
    how:"Sa grande lame pousse devant lui. Ses chenilles l'empêchent de glisser."},
  rouleau:{short:'Le rouleau',full:'Le rouleau compresseur',verb:'Rouler',horn:'horn',
    use:'Il tasse les cailloux pour que la route soit bien solide.',
    how:'Son gros rouleau en métal est très lourd, et il vibre pour écraser les cailloux.'},
  grue:{short:'La grue',full:'La grue',verb:'Soulever',horn:'bell',
    use:'Elle soulève des choses très lourdes, tout là-haut.',
    how:"Le crochet descend, attrape, puis remonte. Elle aide à construire l'immeuble."},
  toupie:{short:'La toupie',full:'Le camion toupie',verb:'Verser',horn:'horn',
    use:'Il apporte le béton pour faire les murs et le sol.',
    how:'Sa grosse toupie tourne tout le temps, pour que le béton reste mou.'},
  tractopelle:{short:'La tractopelle',full:'La tractopelle',verb:'Creuser',horn:'horn',
    use:'Elle creuse des tranchées pour passer les tuyaux.',
    how:'Devant, elle a un godet pour pousser. Derrière, un bras pour creuser. Ses béquilles la tiennent bien.'},
  pompe:{short:'La pompe',full:'La pompe à béton',verb:'Pomper',horn:'horn',
    use:'Elle envoie le béton tout en haut des immeubles.',
    how:'Son grand bras se déplie très haut. Le béton monte dans un tuyau et coule là où il faut.'},
  niveleuse:{short:'La niveleuse',full:'La niveleuse',verb:'Niveler',horn:'horn',
    use:'Elle étale les cailloux bien à plat pour faire la route.',
    how:'Sa longue lame, sous son ventre, gratte et pousse les cailloux. Son long cou l’aide à aller tout droit.'},
  finisseur:{short:'Le finisseur',full:'Le finisseur et le rouleau tandem',verb:'Goudronner',horn:'horn',
    use:'Il pose le goudron tout chaud sur la route.',
    how:'Un camion remplit sa trémie d’enrobé. Il l’étale derrière lui, et un rouleau tandem le tasse.'},
  nacelle:{short:'La nacelle',full:'La nacelle élévatrice',verb:'Monter',horn:'bell',
    use:'Elle fait monter les ouvriers tout en haut des murs.',
    how:"Ses bras se déplient comme des ciseaux, et la plateforme monte avec l'ouvrier dessus."}
};

const ORDER=['pelleteuse','camion','tractopelle','dumper','chargeuse','grue','pompe','toupie','nacelle','bulldozer','niveleuse','rouleau','finisseur'];
const GND='<path class="gnd" d="M4 75H116"/>';
const ICONS={
 pelleteuse:GND+`<rect class="k" x="8" y="58" width="58" height="15" rx="7.5"/><circle class="s" cx="17" cy="65.5" r="4"/><circle class="s" cx="37" cy="65.5" r="4"/><circle class="s" cx="57" cy="65.5" r="4"/>
  <rect class="y" x="10" y="38" width="52" height="19" rx="3"/><rect class="yd" x="6" y="40" width="10" height="16" rx="2"/>
  <rect class="y" x="36" y="18" width="22" height="22" rx="3"/><rect class="g" x="41" y="22" width="13" height="12" rx="1.5"/>
  <path class="arm" d="M58 42L84 14L102 42"/><path class="yd" d="M95 40h16l-3 14h-11z"/>`,
 camion:GND+`<rect class="k" x="8" y="52" width="100" height="6" rx="2"/><path class="d" d="M14 26q12-12 26-5 14-9 30 5z"/><path class="o" d="M10 24h64v28H16z"/>
  <rect class="b" x="78" y="28" width="30" height="26" rx="3"/><rect class="g" x="92" y="32" width="12" height="11" rx="1.5"/>
  <circle class="k" cx="24" cy="62" r="10"/><circle class="s" cx="24" cy="62" r="4"/><circle class="k" cx="46" cy="62" r="10"/><circle class="s" cx="46" cy="62" r="4"/><circle class="k" cx="94" cy="62" r="10"/><circle class="s" cx="94" cy="62" r="4"/>`,
 dumper:GND+`<path class="yd" d="M62 24h44l-6 26H66z"/><path class="d" d="M66 24q10-12 20-4 10-8 18 4z"/><rect class="y" x="20" y="40" width="50" height="16" rx="3"/>
  <path class="ln" d="M26 40V14H46V40"/><rect class="k" x="30" y="30" width="12" height="10" rx="2"/>
  <circle class="k" cx="32" cy="62" r="12"/><circle class="s" cx="32" cy="62" r="5"/><circle class="k" cx="88" cy="62" r="12"/><circle class="s" cx="88" cy="62" r="5"/>`,
 chargeuse:GND+`<rect class="y" x="10" y="38" width="44" height="18" rx="3"/><rect class="y" x="30" y="16" width="22" height="24" rx="3"/><rect class="g" x="35" y="20" width="13" height="13" rx="1.5"/>
  <path class="arm" d="M52 40L84 50"/><path class="yd" d="M84 34q22 2 26 22H82z"/><rect class="y" x="50" y="44" width="22" height="10" rx="2"/>
  <circle class="k" cx="26" cy="62" r="12"/><circle class="s" cx="26" cy="62" r="5"/><circle class="k" cx="72" cy="62" r="12"/><circle class="s" cx="72" cy="62" r="5"/>`,
 bulldozer:GND+`<rect class="k" x="14" y="58" width="62" height="15" rx="7.5"/><circle class="s" cx="23" cy="65.5" r="4"/><circle class="s" cx="45" cy="65.5" r="4"/><circle class="s" cx="67" cy="65.5" r="4"/>
  <rect class="y" x="18" y="38" width="56" height="20" rx="3"/><rect class="y" x="20" y="16" width="26" height="24" rx="3"/><rect class="g" x="25" y="21" width="16" height="12" rx="1.5"/>
  <rect class="k" x="58" y="24" width="4" height="14"/><rect class="k" x="72" y="50" width="22" height="5"/><path class="yd" d="M92 30q12 16 0 44h9q5-22 0-44z"/>`,
 grue:GND+`<rect class="c" x="20" y="66" width="24" height="9"/><path class="lat" d="M28 66V12M36 66V12M28 66l8-8-8-8 8-8-8-8 8-8-8-8"/>
  <path class="lat" d="M8 10H112M8 17H112M14 17l6-7 6 7 6-7 6 7 6-7 6 7 6-7 6 7 6-7 6 7 6-7 6 7 6-7 6 7 6-7"/>
  <rect class="c" x="8" y="17" width="12" height="9"/><rect class="w" x="38" y="17" width="9" height="8"/>
  <rect class="k" x="84" y="17" width="9" height="4"/><path class="ln" d="M88.5 21V48"/><rect class="y" x="84" y="47" width="9" height="6" rx="1"/>
  <rect class="br" x="76" y="56" width="25" height="16"/><path d="M76 61h25M76 66h25M84 56v5M93 61v5M84 66v6" stroke="#fff" stroke-width="1.2" fill="none" opacity=".6"/>`,
 toupie:GND+`<rect class="k" x="8" y="52" width="102" height="6" rx="2"/><rect class="w" x="82" y="28" width="26" height="26" rx="3"/><rect class="g" x="94" y="32" width="10" height="11"/><rect class="o" x="82" y="45" width="26" height="4"/>
  <g transform="rotate(-8 44 36)"><ellipse class="o" cx="44" cy="36" rx="34" ry="15"/><path class="st" d="M24 25L34 48M40 22L52 49M58 24L68 46"/></g>
  <path class="s" d="M3 33h12l-4 9H0z"/>
  <circle class="k" cx="24" cy="62" r="10"/><circle class="s" cx="24" cy="62" r="4"/><circle class="k" cx="46" cy="62" r="10"/><circle class="s" cx="46" cy="62" r="4"/><circle class="k" cx="96" cy="62" r="10"/><circle class="s" cx="96" cy="62" r="4"/>`,
 rouleau:GND+`<circle class="s" cx="90" cy="57" r="17"/><circle class="k" cx="90" cy="57" r="6"/><rect class="y" x="76" y="34" width="28" height="8" rx="2"/><rect class="y" x="98" y="38" width="5" height="16"/>
  <rect class="y" x="16" y="38" width="58" height="22" rx="3"/><rect class="k" x="24" y="16" width="3" height="22"/><rect class="k" x="52" y="16" width="3" height="22"/><rect class="k" x="20" y="12" width="40" height="5" rx="2"/>
  <circle class="k" cx="32" cy="62" r="12"/><circle class="s" cx="32" cy="62" r="5"/>`,
 tractopelle:GND+`<rect class="y" x="36" y="36" width="46" height="18" rx="3"/><rect class="y" x="44" y="14" width="24" height="24" rx="3"/><rect class="g" x="48" y="18" width="16" height="13" rx="1.5"/>
  <path class="arm" d="M38 38L20 14L6 34"/><path class="yd" d="M2 32h12l-2 10H4z"/><path class="arm" d="M80 42L100 52"/><path class="yd" d="M96 44h18l-4 14H96z"/>
  <circle class="k" cx="46" cy="62" r="12"/><circle class="s" cx="46" cy="62" r="5"/><circle class="k" cx="84" cy="66" r="8"/><circle class="s" cx="84" cy="66" r="3"/>`,
 pompe:GND+`<path class="arm" d="M50 36L66 8L104 14L112 34" style="stroke:#e5452c"/><path class="ln" d="M112 34v10"/><rect class="r" x="8" y="38" width="76" height="14" rx="2"/><rect class="w" x="84" y="30" width="26" height="24" rx="3"/><rect class="g" x="96" y="34" width="10" height="9"/>
  <circle class="k" cx="20" cy="62" r="9"/><circle class="k" cx="40" cy="62" r="9"/><circle class="k" cx="96" cy="62" r="9"/>`,
 niveleuse:GND+`<rect class="y" x="6" y="34" width="34" height="20" rx="3"/><rect class="y" x="28" y="14" width="20" height="22" rx="3"/><rect class="g" x="32" y="18" width="12" height="12" rx="1.5"/>
  <path class="arm" d="M40 40Q70 22 104 52"/><path class="yd" d="M50 58q12-6 26 0l-2 6H52z"/>
  <circle class="k" cx="14" cy="64" r="9"/><circle class="k" cx="34" cy="64" r="9"/><circle class="k" cx="104" cy="64" r="9"/>`,
 finisseur:GND+`<rect x="2" y="66" width="60" height="8" fill="#2a2e3d"/><rect class="y" x="58" y="38" width="40" height="20" rx="3"/><path class="yd" d="M96 40h20l-4 16H96z"/><rect class="y" x="50" y="56" width="12" height="12"/>
  <path class="ln" d="M64 38V20M90 38V20"/><rect class="w" x="60" y="16" width="34" height="6"/><rect class="k" x="60" y="60" width="38" height="12" rx="6"/>
  <circle class="s" cx="10" cy="62" r="10"/><circle class="s" cx="40" cy="62" r="10"/><rect class="y" x="10" y="40" width="30" height="12" rx="3"/>`,
 nacelle:GND+`<rect class="c" x="70" y="6" width="44" height="62"/><rect class="g" x="80" y="14" width="10" height="12"/><rect class="g" x="96" y="14" width="10" height="12"/><rect class="g" x="80" y="36" width="10" height="12"/>
  <rect class="o" x="14" y="10" width="50" height="6" rx="2"/><path class="ln" d="M16 10V2H62V10"/><path class="ln" d="M20 18L58 32L20 46L58 60M58 18L20 32L58 46L20 60"/>
  <rect class="o" x="12" y="58" width="54" height="10" rx="3"/><circle class="k" cx="22" cy="70" r="5"/><circle class="k" cx="56" cy="70" r="5"/>`
};

// Layout coordinates: h runs left → right on screen in the overview, d runs from the back (−) to the front (+).
const S2=Math.SQRT1_2;
const Q=(h,d)=>[(h+d)*S2,(d-h)*S2];
const YAW=Math.PI/4;   // a machine facing screen-right in the overview
const YAWF=-Math.PI/4; // a machine driving towards the front (along a street that comes towards us)
const CF=(h,d,yaw=YAW)=>{const [x,z]=Q(h,d);return {x,z,yaw};};
const CFG={
  pelleteuse:CF(18,-20), camion:CF(27,-8), dumper:CF(5,-11), chargeuse:CF(20,17),
  bulldozer:CF(-27,38), niveleuse:CF(-12,38), rouleau:CF(4,38), finisseur:CF(23,38), tractopelle:CF(-12.6,21,YAWF), pompe:CF(-27.5,-14),
  grue:CF(-16,-21), toupie:CF(-31,-6), nacelle:CF(3,-21)
};

// ground painting helpers (world coordinates come from Q)
const GR=[];const GB=[];const GP=[];
const rect=(h,d,len,wid,along,col,al=1,stripes)=>{const [cx,cz]=Q(h,d);GR.push({cx,cz,len,wid,rot:along==='h'?-Math.PI/4:Math.PI/4,col,al,stripes});};
const blob=(h,d,r,col)=>{const [x,z]=Q(h,d);GB.push([x,z,r,col]);};
const path=(pts,w,col,al)=>GP.push({pts:pts.map(([h,d])=>Q(h,d)),w,col,al});

// the main road (finished), the new street of the housing estate, the site tracks
rect(0,4,92,5.6,'h','#3b3a52');rect(0,4,92,.18,'h','#f3efe2',.6);
for(let h=-42;h<42;h+=3.2)rect(h,4,1.6,.16,'h','#f3efe2',.9);
rect(0,.6,92,1.4,'h','#b6b2d6');rect(0,7.4,92,1.4,'h','#b6b2d6');
[-33,33].forEach(h=>rect(h,4,3,5.6,'h','#f3efe2',.95,'#3b3a52'));
rect(-14,21.5,31,4.4,'d','#3b3a52');for(let d=8;d<35;d+=3.2)rect(-14,d,1.6,.16,'d','#f3efe2',.9);
rect(0,38,104,5.2,'h','#8a6a52');rect(0,35,104,1.2,'h','#b6b2d6');
path([[-34,-6],[-20,-12],[-4,-14],[12,-12],[28,-14],[36,-4]],4,'#c79a92',.55);
path([[8,10],[14,18],[24,22],[34,20]],3.4,'#c79a92',.5);
// site soil
blob(-18,-20,15,'rgba(214,150,120,.55)');blob(20,-20,14,'rgba(214,150,120,.55)');blob(22,18,13,'rgba(214,150,120,.5)');
blob(-27,38,7,'rgba(214,150,120,.5)');blob(-12,38,7,'rgba(214,150,120,.4)');blob(5,-11,8,'rgba(214,150,120,.45)');blob(24,-20,6,'rgba(120,70,46,.7)');
blob(-14,-30,8,'rgba(170,170,200,.35)');blob(3,-28,7,'rgba(170,170,200,.35)');

export default {
  id:'chantier', title:'Le Chantier', titleHtml:'Le <span>Chantier</span>',
  subtitle:'Tout un quartier en construction : un immeuble, une nouvelle rue, des maisons. Touche un engin pour le voir travailler.',
  welcome:'Bienvenue sur le chantier ! Ici, on construit tout un quartier. Touche un engin pour voir comment il marche.',
  hint:'Touche un engin pour le découvrir.', backLabel:'Tout le chantier',
  brandIcon:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 29V5M13 29V5M9 9l4 4-4 4 4 4-4 4M3 5h27M23 5v9"/><rect x="20" y="14" width="6" height="5" rx="1"/></svg>',
  data:DATA, order:ORDER, icons:ICONS, cfg:CFG,
  radius:56, tufts:false,
  overview:{w:88,h:60,focus:[0,3,3]},
  ground:{ base:['#7c79c6','#6a68b6','#4a4a8a'], paths:GP, rects:GR, blobs:GB },
  build(ctx){
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx=createFx(scene,140);onUpdate(dt=>fx.update(dt));
    buildScenery(scene,onUpdate);
/* ---- pelleteuse ---- */
(function(){
  const st=makeStation('pelleteuse'),S=st.g,m=grp(S);st.m=m;
  st.tracks=[trackUnit(m,{len:4.1,r:.42,w:.62,z:1.18,guard:true}),trackUnit(m,{len:4.1,r:.42,w:.62,z:-1.18,guard:true})];
  rbox(m,1.9,.42,1.7,.08,MT.dark,0,.64,0);cylY(m,.55,.3,MT.dark,0,.9,0,20);
  const tur=grp(m,0,1.04,0);st.tur=tur;
  cylY(tur,1.05,.16,MT.black,0,.08,0,28);
  rbox(tur,3.45,.26,2.42,.06,MT.dark,-.47,.29,0);
  extY(tur,[[-1.38,-1.2],[-1.38,1.2],[-2.0,1.2],[-2.42,.75],[-2.5,0],[-2.42,-.75],[-2.0,-1.2]],.32,1.05,MT.yel,0,.95,0);
  rbox(tur,.04,.22,1.2,.02,MT.stripes,-2.52,.75,0,.01);
  [.62,-.62].forEach(z=>rbox(tur,.04,.1,.2,.02,MT.tail,-2.48,1.2,z,.01));
  rbox(tur,1.6,.64,2.3,.14,MT.yel,-.58,.74,0);
  [1,-1].forEach(s=>{for(let k=0;k<7;k++)box(tur,.045,.36,.02,MT.black,-1.18+k*.13,.72,s*1.155);});
  rbox(tur,.9,.04,.9,.02,MT.black,-.75,1.07,-.4,.01);
  cylY(tur,.07,.62,MT.black,-.95,1.35,-.62,10);const cap=cylY(tur,.085,.03,MT.black,-.97,1.67,-.62,10);cap.rotation.z=.4;
  rbox(tur,1.1,.72,.92,.1,MT.yel,.62,.8,-.73);
  rail(tur,[[.15,1.16,-1.12],[.15,1.5,-1.12],[1.1,1.5,-1.12],[1.1,1.16,-1.12]],.025,MT.yel);
  rail(tur,[[-1.3,1.06,-1.12],[-1.3,1.36,-1.12],[-.1,1.36,-1.12]],.025,MT.yel);
  const cab=grp(tur,.62,.42,.72);
  rbox(cab,1.3,.1,1.0,.03,MT.dark,0,.05,0);rbox(cab,.1,1.45,1.0,.04,MT.yel,-.6,.77,0);rbox(cab,.08,.45,1.0,.03,MT.yel,.6,.3,0);
  [.47,-.47].forEach(z=>{rod(cab,new V3(.6,.1,z),new V3(.48,1.48,z),.035,MT.yel);rod(cab,new V3(-.06,.1,z),new V3(-.06,1.48,z),.03,MT.yel);rbox(cab,1.15,.2,.04,.02,MT.yel,0,.2,z,.01);});
  rbox(cab,1.36,.1,1.08,.05,MT.yel,-.02,1.52,0);
  const wsh=box(cab,.02,1.32,.9,MT.glass,.55,.8,0);wsh.rotation.z=.088;
  box(cab,1.1,1.22,.02,MT.glass,0,.85,.48);box(cab,1.1,1.22,.02,MT.glass,0,.85,-.48);
  rod(cab,new V3(.6,.35,.1),new V3(.55,.95,-.18),.012,MT.black);
  rbox(cab,.1,.03,.03,.01,MT.chrome,-.15,.78,.5,.008);
  rod(cab,new V3(.5,1.25,.48),new V3(.78,1.38,.62),.02,MT.black);rbox(cab,.04,.24,.15,.03,MT.black,.8,1.36,.64);
  [.32,-.32].forEach(z=>rbox(cab,.08,.09,.14,.02,MT.lamp,.62,1.6,z,.01));
  beacon(st,cab,-.42,1.57,.28);
  operator(cab,-.15,.12,0);cylY(cab,.025,.25,MT.black,.18,.35,.3,6);cylY(cab,.025,.25,MT.black,.18,.35,-.3,6);
  const boom=grp(tur,1.05,.84,-.02);
  ext(boom,[[-.06,.22],[1.71,.69],[3.3,.19],[3.2,-.19],[1.69,.2],[.06,-.22]],[.15,.25,.15,.15,.25,.15],.44,MT.yel,0,0,0,.03);
  cylZ(boom,.11,.62,MT.chrome,0,0,0,12);cylZ(boom,.1,.6,MT.chrome,3.25,0,0,12);
  rbox(boom,.3,.16,.36,.04,MT.yelD,1.92,.75,0);
  [.13,-.13].forEach(z=>{rod(boom,new V3(.4,.36,z),new V3(1.7,.76,z),.022,MT.black);rod(boom,new V3(1.7,.76,z),new V3(3.0,.34,z),.022,MT.black);});
  const stick=grp(boom,3.25,0,0);
  ext(stick,[[-.62,.3],[-.32,.38],[2.45,.15],[2.58,0],[2.45,-.15],[0,-.2],[-.52,-.1]],.08,.36,MT.yel,0,0,0,.03);
  cylZ(stick,.08,.48,MT.chrome,2.48,0,0,12);
  [.12,-.12].forEach(z=>rod(stick,new V3(-.3,.4,z),new V3(2.2,.2,z),.02,MT.black));
  const bucket=grp(stick,2.48,0,0);
  const outer=arc(.4,-.3,.62,118,-60,14),inner=arc(.4,-.3,.54,-60,118,14);
  ext(bucket,outer.concat(inner),0,.9,MT.yelD,0,0,0,.015);
  ext(bucket,outer.concat([[.4,-.3]]),0,.05,MT.yelD,0,0,.44,.01);ext(bucket,outer.concat([[.4,-.3]]),0,.05,MT.yelD,0,0,-.44,.01);
  const TOOTH=new THREE.ConeGeometry(.055,.22,4);TOOTH.translate(0,.11,0);
  for(let i=-2;i<=2;i++){const t=add(bucket,TOOTH,MT.steel,.7,-.83,i*.18);t.rotation.z=rad(120);}
  rbox(bucket,.1,.06,.92,.02,MT.steel,.68,-.8,0);
  [.25,-.25].forEach(z=>ext(bucket,[[-.12,.12],[-.2,.36],[-.06,.42],[.22,.3],[.16,.08]],.05,.05,MT.yelD,0,0,z,.01));
  cylZ(bucket,.06,.56,MT.chrome,-.14,.32,0,10);cylZ(bucket,.07,.56,MT.chrome,0,0,0,10);
  const ball=add(bucket,ICO,C.dirt,.42,-.32,0);ball.scale.setScalar(.4);ball.visible=false;
  Object.assign(st,{boom,stick,bucket,ball});
  st.links=[
    hydraulic(tur,anchor(tur,1.0,.42,.15),anchor(boom,1.35,-.08,.17),{barrel:1.0,rb:.1}),
    hydraulic(tur,anchor(tur,1.0,.42,-.19),anchor(boom,1.35,-.08,-.17),{barrel:1.0,rb:.1}),
    hydraulic(boom,anchor(boom,1.95,.78,0),anchor(stick,-.55,.32,0),{barrel:1.15,rb:.1}),
    hydraulic(stick,anchor(stick,.25,.38,0),anchor(bucket,-.14,.32,0),{barrel:1.3,rb:.085})];
  const REST={boom:35,stick:-105,bucket:-50};
  const setPose=p=>{boom.rotation.z=rad(p.boom);stick.rotation.z=rad(p.stick);bucket.rotation.z=rad(p.bucket);};
  const poseTo=(p,dur)=>{const f={b:boom.rotation.z,s:stick.rotation.z,k:bucket.rotation.z};const t={b:p.boom!=null?rad(p.boom):f.b,s:p.stick!=null?rad(p.stick):f.s,k:p.bucket!=null?rad(p.bucket):f.k};
    return tw(dur,k=>{boom.rotation.z=f.b+(t.b-f.b)*k;stick.rotation.z=f.s+(t.s-f.s)*k;bucket.rotation.z=f.k+(t.k-f.k)*k;});};
  setPose(REST);
  const hole=grp(S,5.1,0,0);
  const ho=add(hole,new THREE.CircleGeometry(1,20),0x8a5634,0,.03,0);ho.rotation.x=-Math.PI/2;
  const hi=add(hole,new THREE.CircleGeometry(.68,18),0x24160f,0,.045,0);hi.rotation.x=-Math.PI/2;
  hole.scale.setScalar(.5);
  const DUMP=2.6;const pl=pile(S,Math.cos(DUMP)*5.6,-Math.sin(DUMP)*5.6,.35);
  part(st,'bras','le bras',anchor(boom,1.7,.8,0),true);
  part(st,'verins','les vérins',anchor(boom,1.1,-.25,.3),true);
  part(st,'godet','le godet',anchor(bucket,.5,-.2,0),true);
  part(st,'cabine','la cabine',anchor(cab,0,1.75,0),true);
  part(st,'chenilles','les chenilles',anchor(st.tracks[0].g,0,.5,.5),true);
  st.focus=new V3(2.2,1.7,-1.4);st.size={w:12,h:7.5};st.tagAt=anchor(S,0,5,0);
  st.update=dt=>roll(st,dt);
  st.action=async function(){
    engineOn(52);
    await Promise.all([step('Les vérins font descendre le bras.','verins'),poseTo({boom:-5,stick:-55,bucket:-20},1.7)]);
    const hs=Math.min(1.4,hole.scale.x+.15);
    await Promise.all([step('Le godet gratte la terre, comme une grosse cuillère.','godet'),poseTo({boom:10,stick:-120,bucket:-95},1.7),
      to(hole.scale,'x',hs,1.2),to(hole.scale,'z',hs,1.2),
      sleep(.55).then(()=>{ball.visible=true;const h=wp(hole,.2);for(let i=0;i<5;i++)throwClod(h,h.clone().add(new V3(rnd(-1,1),0,rnd(-1,1))));})]);
    await Promise.all([step('Les vérins poussent, et le bras remonte.','verins'),poseTo({boom:38,stick:-110,bucket:-95},1.2)]);
    await Promise.all([step('La cabine tourne sur elle-même.','cabine'),to(tur.rotation,'y',DUMP,2.1)]);
    await poseTo({boom:20,stick:-75,bucket:-95},.7);
    await Promise.all([step('Et hop ! On vide le godet.','godet'),poseTo({bucket:25},.6).then(()=>{
      const from=wp(ball),target=wp(pl,.3);ball.visible=false;thud();for(let i=0;i<12;i++)throwClod(from,target);
      const s0=pl.scale.x,s1=Math.min(1.35,s0+.14);return tw(.9,k=>pl.scale.setScalar(s0+(s1-s0)*k));})]);
    await Promise.all([poseTo(REST,1.5),to(tur.rotation,'y',0,2.1)]);
  };
})();

/* ---- camion-benne ---- */
(function(){
  const st=makeStation('camion'),S=st.g,m=grp(S);st.m=m;
  [.42,-.42].forEach(z=>rbox(m,5.85,.3,.16,.03,MT.black,0,.97,z));
  for(let x=-2.4;x<2.6;x+=1.2)box(m,.12,.2,.8,MT.black,x,.97,0);
  const cab=truckCab(m,MT.blue,1.45);
  cylX(m,.27,1.0,MT.chrome,.55,.72,.78,18);[.2,.9].forEach(x=>cylX(m,.285,.05,MT.black,x,.72,.78,18));
  cylX(m,.17,.8,MT.dark,.55,.72,-.72,14);rbox(m,.5,.4,.35,.04,MT.black,.0,.75,-.72);
  [1,-1].forEach(s=>{rail(m,[[-.55,.45,s*1.1],[.05,.45,s*1.1]],.03,MT.grey);rail(m,[[-.55,.7,s*1.1],[.05,.7,s*1.1]],.03,MT.grey);
    rbox(m,.06,.45,.6,.02,MT.black,-2.65,.6,s*.95);rbox(m,.9,.05,.62,.02,MT.black,-1.5,1.17,s*.92);});
  rbox(m,.12,.22,2.1,.03,MT.stripes,-2.9,.72,0,.01);[.85,-.85].forEach(z=>rbox(m,.05,.12,.22,.02,MT.tail,-2.97,.92,z,.01));
  st.wheels=[];
  [1,-1].forEach(s=>{st.wheels.push(tire(m,.55,.4,2.3,.55,s*.9,MT.grey));st.wheels.push(tire(m,.55,.3,-1.0,.55,s*.82,MT.grey,s),tire(m,.55,.3,-1.0,.55,s*1.13,MT.grey,s));
    st.wheels.push(tire(m,.55,.3,-2.05,.55,s*.82,MT.grey,s),tire(m,.55,.3,-2.05,.55,s*1.13,MT.grey,s));
    fender(m,.66,.48,2.3,.55,s*.92,MT.black);});
  const bed=grp(m,-2.6,1.38,0);
  rbox(bed,3.7,.14,2.2,.03,MT.orange,1.85,0,0);
  [.4,-.4].forEach(z=>rbox(bed,3.6,.14,.14,.02,MT.orangeD,1.85,-.13,z));
  [1.05,-1.05].forEach(z=>{ext(bed,[[0,.06],[3.7,.06],[3.7,1.18],[.15,1.02]],.04,.1,MT.orange,0,0,z,.02);
    [.55,1.3,2.05,2.8].forEach(x=>rbox(bed,.1,1.0,.07,.02,MT.orangeD,x,.56,z*1.06,.01));
    rbox(bed,3.75,.1,.14,.03,MT.orangeD,1.85,1.12,z);});
  rbox(bed,.14,1.48,2.2,.03,MT.orange,3.65,.76,0);rbox(bed,.75,.1,2.2,.03,MT.orange,4.0,1.5,0);
  rbox(bed,.3,.25,.4,.04,MT.dark,3.85,1.05,0);
  const gate=grp(bed,-.02,1.08,0);rbox(gate,.1,1.02,2.12,.03,MT.orange,-.04,-.52,0);[.6,0,-.6].forEach(z=>rbox(gate,.05,.95,.07,.01,MT.orangeD,-.1,-.5,z,.01));
  cylZ(bed,.05,2.3,MT.chrome,-.02,1.08,0,8);
  const dirt=grp(bed,0,0,0);
  box(dirt,3.3,.55,1.85,C.dirt,1.9,.36,0);
  [[1.1,.72,.35,.55],[2.1,.78,-.3,.6],[2.9,.7,.25,.45]].forEach(([x,y,z,s])=>{const l=add(dirt,ICO,C.dirtD,x,y,z);l.scale.set(s,s*.6,s);});
  st.links=[telescopic(m,anchor(m,1.28,1.05,0),anchor(bed,3.88,1.05,0),{n:5,stage:1.1,r:.15})];
  const pl=pile(S,-5.9,0,.35);
  part(st,'cabine','la cabine',anchor(cab,.8,2.05,0),true);
  part(st,'benne','la benne',anchor(bed,1.8,1.3,0),true);
  part(st,'verin','le vérin',anchor(m,1.28,1.9,.3),true);
  part(st,'porte','la porte',anchor(gate,-.1,-.5,.6),false);
  st.focus=new V3(-1.6,1.7,0);st.size={w:12,h:7.2};st.tagAt=anchor(S,0,4.5,0);
  const rear=anchor(bed,.1,.5,0);
  st.update=dt=>{roll(st,dt);gate.rotation.z=-bed.rotation.z*.92;st.A.verin.position.y=1.5+bed.rotation.z*1.6;};
  st.action=async function(){
    engineOn(60);
    st.reversing=true;st.beepT=0;
    await Promise.all([step('Bip, bip ! Le camion recule.','cabine'),to(m.position,'x',-1.6,2.4)]);
    st.reversing=false;
    await Promise.all([step('Le grand vérin s\'allonge, et la benne se lève.','verin'),to(bed.rotation,'z',.95,2.4)]);
    let sent=0;const target=wp(pl,.3);
    await Promise.all([step('La porte s\'ouvre, et la terre glisse.','porte'),
      tw(1.5,k=>{dirt.position.x=-3.4*k;const want=Math.floor(k*16);while(sent<want){throwClod(wp(rear),target);sent++;}},easeIn),
      (()=>{const s0=pl.scale.x,s1=Math.min(1.35,s0+.16);return sleep(.5).then(()=>{thud();return tw(1.2,k=>pl.scale.setScalar(s0+(s1-s0)*k));});})()]);
    dirt.visible=false;
    await Promise.all([step('Le vérin rentre, et la benne redescend.','verin'),to(bed.rotation,'z',0,1.8)]);
    await to(m.position,'x',0,2.0);
    dirt.position.x=0;pop(dirt,.5);
  };
})();

/* ---- bulldozer ---- */
(function(){
  const st=makeStation('bulldozer'),S=st.g,m=grp(S);st.m=m;
  st.tracks=[trackUnit(m,{len:3.7,r:.4,w:.6,z:1.06}),trackUnit(m,{len:3.7,r:.4,w:.6,z:-1.06})];
  rbox(m,3.2,.5,1.45,.06,MT.dark,0,.78,0);
  ext(m,[[-.5,.98],[1.5,.98],[1.6,1.55],[1.42,1.86],[-.5,1.92]],[.05,.05,.12,.12,.05],1.46,MT.yel,0,0,0,.03);
  rbox(m,.08,.66,1.22,.03,MT.black,1.6,1.28,0);for(let i=0;i<6;i++)box(m,.03,.035,1.12,MT.dark,1.66,1.02+i*.1,0);
  rail(m,[[1.62,.98,.66],[1.66,1.62,.66],[1.66,1.62,-.66],[1.62,.98,-.66]],.035,MT.yelD);
  [1,-1].forEach(s=>{for(let k=0;k<6;k++)box(m,.05,.4,.02,MT.black,.15+k*.17,1.42,s*.745);
    rail(m,[[-.35,1.92,s*.66],[-.35,2.18,s*.66],[1.2,2.18,s*.66],[1.2,1.88,s*.66]],.025,MT.yel);
    rbox(m,.08,.12,.16,.03,MT.lamp,1.45,1.9,s*.5,.01);});
  cylY(m,.07,.75,MT.black,.95,2.25,-.35,10);const ec=cylY(m,.085,.03,MT.black,.97,2.63,-.35,10);ec.rotation.z=.4;
  cylY(m,.11,.4,MT.dark,.95,2.1,.32,12);sph(m,.13,MT.black,.95,2.36,.32);
  rbox(m,1.05,1.05,1.72,.12,MT.yel,-1.35,1.42,0);rbox(m,.04,.22,1.2,.02,MT.stripes,-1.89,1.2,0,.01);
  [.65,-.65].forEach(z=>rbox(m,.04,.1,.18,.02,MT.tail,-1.89,1.65,z,.01));
  const cab=grp(m,-.75,1.95,0);
  rbox(cab,1.35,.1,1.62,.03,MT.dark,0,.05,0);
  [[.62,.78],[.62,-.78],[-.62,.78],[-.62,-.78]].forEach(([x,z])=>rbox(cab,.09,1.48,.09,.03,MT.yel,x,.8,z,.01));
  rbox(cab,1.45,.14,1.75,.06,MT.yel,0,1.58,0);rbox(cab,1.25,.35,.05,.02,MT.yel,0,.25,.78,.01);rbox(cab,1.25,.35,.05,.02,MT.yel,0,.25,-.78,.01);
  box(cab,.02,1.1,1.48,MT.glass,.62,.95,0);box(cab,.02,1.1,1.48,MT.glass,-.62,.95,0);box(cab,1.15,1.1,.02,MT.glass,0,.95,.78);box(cab,1.15,1.1,.02,MT.glass,0,.95,-.78);
  rbox(cab,.1,.03,.03,.01,MT.chrome,-.1,.75,.8,.008);
  [.5,-.5].forEach(z=>rbox(cab,.08,.09,.15,.02,MT.lamp,.66,1.6,z,.01));
  rod(cab,new V3(.6,1.25,.8),new V3(.82,1.35,.95),.02,MT.black);rbox(cab,.04,.24,.15,.03,MT.black,.84,1.33,.97);
  beacon(st,cab,-.45,1.65,-.4);
  operator(cab,-.15,.1,0);
  const blade=grp(m,2.25,0,0);
  const bo=arc(.9,.75,1.07,140,220,12),bi=arc(.9,.75,.95,220,140,12);
  ext(blade,bo.concat(bi),0,3.6,MT.yel,0,0,0,.02);
  rbox(blade,.12,.14,3.62,.02,MT.steel,.2,.12,0);rbox(blade,.2,.12,3.6,.03,MT.yelD,.1,1.4,0);
  [1.78,-1.78].forEach(z=>{ext(blade,[[.17,.06],[-.18,.28],[-.18,1.2],[.12,1.42]],.04,.07,MT.yelD,0,0,z,.01);rbox(blade,.16,.3,.08,.02,MT.steel,.22,.2,z*1.01,.01);});
  [1.2,0,-1.2].forEach(z=>rbox(blade,.18,1.0,.1,.02,MT.yelD,-.12,.75,z,.01));
  const bladeAnch={pa:anchor(blade,-.18,.35,1.35),pb:anchor(blade,-.18,.35,-1.35),la:anchor(blade,-.18,1.15,.55),lb:anchor(blade,-.18,1.15,-.55)};
  st.links=[strut(m,anchor(m,-.1,.55,1.42),bladeAnch.pa,.16,MT.yelD),strut(m,anchor(m,-.1,.55,-1.42),bladeAnch.pb,.16,MT.yelD),
    hydraulic(m,anchor(m,1.35,1.75,.6),bladeAnch.la,{barrel:.75,rb:.085}),hydraulic(m,anchor(m,1.35,1.75,-.6),bladeAnch.lb,{barrel:.75,rb:.085})];
  rbox(m,.25,.25,1.5,.05,MT.dark,-2.05,1.0,0);
  ext(m,[[0,0],[.16,0],[.12,-.85],[-.02,-1.05],[-.08,-.8]],.03,.12,MT.dark,-2.25,.98,0,.02);
  const rt=add(m,new THREE.ConeGeometry(.06,.2,4),MT.steel,-2.27,.0,0);rt.rotation.z=rad(160);
  [.5,-.5].forEach(z=>{rod(m,new V3(-1.88,1.55,z),new V3(-2.15,1.02,z),.06,MT.yel);rod(m,new V3(-1.95,1.42,z),new V3(-2.08,1.15,z),.035,MT.chrome);});
  const SG=new THREE.BoxGeometry(1,.04,3.3);SG.translate(.5,0,0);
  const strip=add(S,SG,0xc89270,2.45,.025,0);strip.scale.x=.001;
  const chunks=[];
  for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*1.3,s=rnd(.32,.55);
    const b={x:4.75+Math.cos(a)*r,z:Math.sin(a)*r*1.15,y:s*.5+(1-r/1.3)*.75,s};const mm=add(S,ICO,i%3?C.dirt:C.dirtD,b.x,b.y,b.z);mm.scale.setScalar(s);mm.rotation.set(rnd(0,3),rnd(0,3),0);chunks.push({m:mm,b});}
  part(st,'lame','la lame',anchor(blade,.2,1.5,1.2),true);
  part(st,'verins','les vérins',anchor(m,1.8,1.6,.75),true);
  part(st,'chenilles','les chenilles',anchor(st.tracks[0].g,0,.5,.5),true);
  part(st,'cabine','la cabine',anchor(cab,0,1.8,0),true);
  part(st,'sol','le sol plat',anchor(S,4.4,.4,0),false);
  st.focus=new V3(2.6,1.3,0);st.size={w:13,h:7};st.tagAt=anchor(S,0,4.6,0);
  st.update=dt=>{roll(st,dt);
    if(st.pushing){const front=m.position.x+2.5;strip.scale.x=Math.max(.001,front-2.45);
      chunks.forEach(c=>{const p=c.m.position,r=c.b.s;if(p.x<front+r*.7){p.x=front+r*.7+Math.random()*.02;p.y+=(r*.45-p.y)*Math.min(1,dt*4);p.z=clamp(p.z*(1-dt*.25),-1.6,1.6);c.m.rotation.z-=dt*3;}});}};
  st.action=async function(){
    engineOn(48);
    await Promise.all([step('Les vérins baissent la grande lame.','verins'),to(blade.position,'y',-.1,.9)]);
    st.pushing=true;
    await Promise.all([to(m.position,'x',4.4,4.6,easeSine),(async()=>{await step('Le bulldozer avance et pousse la terre.','lame');await step("Ses chenilles l'empêchent de glisser.",'chenilles');})()]);
    st.pushing=false;
    await Promise.all([step('Et voilà, le sol est tout plat !','sol'),to(blade.position,'y',.05,.6)]);
    st.reversing=true;st.beepT=0;await to(m.position,'x',0,2.6);st.reversing=false;blade.position.y=0;
    await tw(.4,k=>chunks.forEach(c=>c.m.scale.setScalar(Math.max(.01,c.b.s*(1-k)))));
    chunks.forEach(c=>c.m.position.set(c.b.x,c.b.y,c.b.z));
    await Promise.all([tw(.5,k=>strip.scale.x=Math.max(.001,strip.scale.x*(1-k))),tw(.7,k=>chunks.forEach(c=>c.m.scale.setScalar(Math.max(.01,c.b.s*k))),easeBack)]);
  };
})();

/* ---- grue ---- */
(function(){
  const st=makeStation('grue'),S=st.g,m=grp(S);st.m=m;
  const H=12,w=.45,RED=MT.red;
  rbox(m,3.2,.25,.6,.04,MT.dark,0,.12,0);rbox(m,.6,.25,3.2,.04,MT.dark,0,.12,0);
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>{rbox(m,.9,.5,.9,.06,MT.concrete,a*1.05,.45,b*1.05);rbox(m,.9,.4,.9,.06,MT.concrete,a*1.05,.9,b*1.05);});
  [[w,w],[w,-w],[-w,w],[-w,-w]].forEach(([x,z])=>rod(m,new V3(x,.25,z),new V3(x,H,z),.06,RED,8));
  for(let y=.6;y<=H+.01;y+=1.14){
    rod(m,new V3(-w,y,w),new V3(w,y,w),.03,RED,6);rod(m,new V3(-w,y,-w),new V3(w,y,-w),.03,RED,6);rod(m,new V3(w,y,-w),new V3(w,y,w),.03,RED,6);rod(m,new V3(-w,y,-w),new V3(-w,y,w),.03,RED,6);
    if(y+1.14<=H+.01){const y2=y+1.14;rod(m,new V3(-w,y,w),new V3(w,y2,w),.025,RED,6);rod(m,new V3(w,y,-w),new V3(w,y2,w),.025,RED,6);rod(m,new V3(w,y,-w),new V3(-w,y2,-w),.025,RED,6);rod(m,new V3(-w,y,w),new V3(-w,y2,-w),.025,RED,6);}}
  for(let y=.8;y<H;y+=.35)box(m,.3,.025,.025,MT.grey,0,y,0);rod(m,new V3(-.15,.6,0),new V3(-.15,H,0),.015,MT.grey);rod(m,new V3(.15,.6,0),new V3(.15,H,0),.015,MT.grey);
  const slew=grp(m,0,H,0);st.slew=slew;
  cylY(slew,.7,.22,MT.dark,0,.11,0,20);rbox(slew,1.8,.18,1.6,.04,MT.dark,0,.3,0);
  rail(slew,[[-.9,.39,.8],[-.9,.85,.8],[.9,.85,.8]],.02,MT.yel);
  const cab=grp(slew,.4,-.05,1.15);
  rbox(cab,1.1,.1,.95,.03,MT.white,0,-.55,0);rbox(cab,.1,1.0,.95,.03,MT.white,-.52,-.05,0);rbox(cab,1.15,.1,1.0,.04,MT.white,0,.47,0);
  [[.52,.45],[.52,-.45]].forEach(([x,z])=>rbox(cab,.06,1.0,.06,.02,MT.white,x,-.05,z,.01));
  box(cab,.02,.9,.86,MT.glass,.53,-.05,0);box(cab,1.0,.9,.02,MT.glass,0,-.05,.47);box(cab,1.0,.9,.02,MT.glass,0,-.05,-.47);
  operator(cab,-.15,-.5,0).scale.setScalar(.95);
  const A=new V3(0,3.0,0);[[.5,.5],[.5,-.5],[-.5,.5],[-.5,-.5]].forEach(([x,z])=>rod(slew,new V3(x,.4,z),A,.07,RED,8));
  sph(slew,.12,MT.tail,0,3.1,0);
  const Lj=10;
  [.35,-.35].forEach(z=>rod(slew,new V3(.5,.32,z),new V3(Lj,.32,z),.06,RED,8));rod(slew,new V3(.5,1.2,0),new V3(Lj,.5,0),.06,RED,8);
  for(let x=.6;x<Lj-.4;x+=1){const yt=1.2-(x+.5)/Lj*.7;[.35,-.35].forEach(z=>{rod(slew,new V3(x,.32,z),new V3(x+.5,yt,0),.025,RED,6);rod(slew,new V3(x+.5,yt,0),new V3(x+1,.32,z),.025,RED,6);});rod(slew,new V3(x,.32,.35),new V3(x,.32,-.35),.025,RED,6);}
  rbox(slew,Lj-.6,.04,.4,.01,MT.dark,Lj/2+.2,.26,0,.01);
  sph(slew,.1,MT.tail,Lj,.6,0);
  rbox(slew,4.6,.16,1.1,.04,MT.dark,-2.5,.3,0);rail(slew,[[-.5,.38,.55],[-4.7,.38,.55]],.02,MT.yel);rail(slew,[[-.5,.75,.55],[-4.7,.75,.55]],.02,MT.yel);
  for(let i=0;i<3;i++)rbox(slew,.42,1.3,1.05,.04,MT.concrete,-4.45+i*.46,-.35,0);
  cylZ(slew,.3,.7,MT.dark,-2.0,.65,0,16);rbox(slew,.6,.5,.4,.05,MT.grey,-2.0,.65,.55);rbox(slew,.5,.7,.3,.04,MT.white,-1.1,.73,-.4);
  rod(slew,A,new V3(6.5,1.0,.15),.025,MT.dark,6);rod(slew,A,new V3(6.5,1.0,-.15),.025,MT.dark,6);rod(slew,A,new V3(-4.6,.4,.3),.025,MT.dark,6);rod(slew,A,new V3(-4.6,.4,-.3),.025,MT.dark,6);
  const trolley=grp(slew,6,.2,0);rbox(trolley,.75,.18,.85,.03,MT.dark,0,0,0);[.4,-.4].forEach(z=>{cylZ(trolley,.08,.06,MT.steel,.25,.1,z,10);cylZ(trolley,.08,.06,MT.steel,-.25,.1,z,10);});
  cylZ(trolley,.12,.12,MT.steel,.15,-.14,0,12);cylZ(trolley,.12,.12,MT.steel,-.15,-.14,0,12);
  const cables=[0,1,2,3].map(()=>add(trolley,cylGeo(5),MT.black));
  const hook=grp(trolley,0,-3,0);
  rbox(hook,.5,.42,.32,.06,MT.yel,0,.16,0);rbox(hook,.52,.14,.34,.04,MT.stripes,0,.04,0,.01);cylZ(hook,.14,.2,MT.steel,0,.32,0,12);
  cylY(hook,.04,.15,MT.steel,0,-.1,0,8);
  const hc=new THREE.CatmullRomCurve3([new V3(0,-.17,0),new V3(0,-.38,0),new V3(.1,-.5,0),new V3(.2,-.42,0),new V3(.2,-.32,0)]);
  add(hook,new THREE.TubeGeometry(hc,16,.035,8),MT.steel);
  st.L=3.5;
  const polar=(x,z)=>({a:Math.atan2(-z,x),r:Math.hypot(x,z)});
  const P1={x:-6,z:3},P2={x:6,z:-3};
  slew.rotation.y=polar(P1.x,P1.z).a+.6;trolley.position.x=6;
  const load=grp(S,P1.x,0,P1.z);
  [.45,0,-.45].forEach(z=>rbox(load,1.5,.1,.14,.02,MT.wood,0,.05,z,.01));[.6,0,-.6].forEach(x=>rbox(load,.14,.08,1.1,.02,MT.wood,x,.14,0,.01));
  rbox(load,1.4,.8,1.0,.02,MT.brick,0,.58,0,.01);
  [[.6,.4],[.6,-.4],[-.6,.4],[-.6,-.4]].forEach(([x,z])=>rod(load,new V3(x,.98,z),new V3(0,1.72,0),.018,MT.black,5));
  const bld=grp(S,P2.x,0,P2.z);rbox(bld,3.8,.3,3.8,.04,MT.concrete,0,.15,0);
  st.floors=[];
  function addFloor(instant){const i=st.floors.length;const f=grp(bld,0,.3+i*1.3,0);
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a,b])=>rbox(f,.3,1.1,.3,.02,MT.concrete,a*1.4,.55,b*1.4,.01));
    rbox(f,3.5,.2,3.5,.03,MT.grey,0,1.2,0,.01);
    rbox(f,2.5,.95,.16,.01,MT.brick,0,.5,1.42,.005);rbox(f,.16,.95,2.5,.01,MT.brick,1.42,.5,0,.005);
    rbox(f,.85,.55,.06,.02,MT.white,0,.55,1.5,.01);box(f,.7,.42,.03,MT.glassD,0,.55,1.53);
    rbox(f,.06,.55,.85,.02,MT.white,1.5,.55,0,.01);box(f,.03,.42,.7,MT.glassD,1.53,.55,0);
    shadows(f);st.floors.push(f);if(!instant){f.scale.set(1,.01,1);return tw(.6,k=>f.scale.y=Math.max(.01,k),easeBack);}}
  addFloor(true);
  part(st,'fleche','la flèche',anchor(slew,5,1.5,0),true);
  part(st,'chariot','le chariot',anchor(trolley,0,.45,0),false);
  part(st,'crochet','le crochet',anchor(hook,0,.7,0),true);
  part(st,'mat','le mât',anchor(m,0,6,0),true);
  part(st,'maison',"l'immeuble",anchor(bld,0,1,0),false);
  st.focus=new V3(0,5.8,0);st.size={w:17,h:16.5};st.tagAt=anchor(S,0,16,0);
  st.update=dt=>{const L=st.L;cables.forEach((c,i)=>{c.scale.set(.018,L+.2,.018);c.position.set(i<2?-.1:.1,-(L+.2)/2-.05,i%2?.05:-.05);});hook.position.y=-L-.2;};
  function slewTo(a,dur){const from=slew.rotation.y;let d=((a-from)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI;return tw(dur,k=>slew.rotation.y=from+d*k);}
  st.action=async function(){
    if(st.floors.length>=5){
      await Promise.all([step("L'immeuble est fini ! On en commence un nouveau.",'maison'),
        tw(.8,k=>st.floors.slice(1).forEach(f=>f.scale.y=Math.max(.01,1-k)))]);
      st.floors.slice(1).forEach(f=>bld.remove(f));st.floors.length=1;
    }
    engineOn(95);
    const p1=polar(P1.x,P1.z),p2=polar(P2.x,P2.z);
    await Promise.all([step('La grue tourne, et le chariot roule sur la flèche.','chariot'),slewTo(p1.a,2.4),to(trolley.position,'x',p1.r,2.4),to(st,'L',3,2.4)]);
    await Promise.all([step('Le crochet descend.','crochet'),to(st,'L',H-.2-1.72+.05,2.4)]);
    st.m.updateMatrixWorld(true);hook.attach(load);ding();
    await Promise.all([step('Il attrape les briques.','crochet'),sleep(.5)]);
    await Promise.all([step('Et ça monte, tout là-haut !','crochet'),to(st,'L',2.4,2.6)]);
    await Promise.all([step("La grue tourne vers l'immeuble.",'fleche'),slewTo(p2.a,2.6),to(trolley.position,'x',p2.r,2.6)]);
    const top=.3+st.floors.length*1.3;
    await to(st,'L',H-.2-(top+1.72)+.05,2.0);
    S.attach(load);load.visible=false;thud();
    await Promise.all([step("On pose les briques. L'immeuble grandit !",'maison'),addFloor(false),to(st,'L',3,1.8)]);
    load.position.set(P1.x,0,P1.z);load.rotation.set(0,0,0);pop(load,.6);
  };
})();

/* ---- toupie ---- */
(function(){
  const st=makeStation('toupie'),S=st.g,m=grp(S);st.m=m;
  [.42,-.42].forEach(z=>rbox(m,6.0,.3,.16,.03,MT.black,-.1,.97,z));
  const cab=truckCab(m,MT.white,1.45);
  [1.11,-1.11].forEach(z=>rbox(cab,1.62,.14,.02,.01,MT.orange,.8,.75,z,.005));
  const sc=document.createElement('canvas');sc.width=256;sc.height=64;const sx=sc.getContext('2d');sx.fillStyle='#f3efe8';sx.fillRect(0,0,256,64);sx.fillStyle='#f06a2a';
  for(let i=-2;i<6;i++){sx.beginPath();sx.moveTo(i*64,64);sx.lineTo(i*64+32,64);sx.lineTo(i*64+72,0);sx.lineTo(i*64+40,0);sx.closePath();sx.fill();}
  const stex=new THREE.CanvasTexture(sc);stex.wrapS=stex.wrapT=THREE.RepeatWrapping;stex.repeat.set(2,1);
  const prof=[[.4,-2.3],[.48,-2.15],[.52,-2.05],[.86,-1.5],[1.15,-.6],[1.22,.25],[1.12,1.1],[.75,1.75],[.3,2.0],[.01,2.04]].map(([r,y])=>new THREE.Vector2(r,y));
  const lg=new THREE.LatheGeometry(prof,40);lg.rotateZ(-Math.PI/2);
  const tilt=grp(m,-.75,2.48,0);tilt.rotation.z=-.15;
  const drum=grp(tilt,0,0,0);add(drum,lg,std(0xffffff,.35,.15,{map:stex,side:THREE.DoubleSide}));
  const ring=add(drum,new THREE.TorusGeometry(.98,.07,8,32),MT.steel,-1.2,0,0);ring.rotation.y=Math.PI/2;
  cylX(tilt,.42,.3,MT.dark,2.15,0,0,16);cylX(tilt,.22,.3,MT.black,2.42,0,0,12);
  rbox(m,.35,1.0,1.3,.05,MT.dark,1.12,1.6,0);rbox(m,.35,.75,1.5,.05,MT.dark,-2.05,1.42,0);
  [.5,-.5].forEach(z=>cylZ(m,.13,.18,MT.steel,-1.95,1.88,z,12));
  const fun=new THREE.CylinderGeometry(.62,.25,.7,12,1,true);const hop=add(m,fun,std(0xee6a26,.45,.2,{side:THREE.DoubleSide}),-3.08,3.38,0);hop.rotation.z=.2;
  rbox(m,.9,.08,1.2,.02,MT.dark,-3.0,2.75,0);rail(m,[[-3.4,2.8,.6],[-3.4,3.3,.6],[-2.6,3.3,.6]],.025,MT.yel);
  [.28,-.28].forEach(z=>rod(m,new V3(-3.35,.25,z),new V3(-3.25,2.75,z),.03,MT.grey,6));for(let y=.45;y<2.7;y+=.32)rod(m,new V3(-3.34,y,.28),new V3(-3.34,y,-.28),.022,MT.grey,6);
  rbox(m,.5,.35,.6,.04,MT.steel,-3.15,2.02,0);
  const chute=grp(m,-3.28,1.68,0);
  ext(chute,[[0,0],[-1.6,0],[-1.6,.18],[0,.18]],.03,.5,MT.steel,0,-.09,0,.01);box(chute,1.6,.04,.4,MT.dark,-.8,.02,0);
  chute.rotation.z=-1.1;
  st.wheels=[];
  [1,-1].forEach(s=>{st.wheels.push(tire(m,.55,.4,2.3,.55,s*.9,MT.grey));
    [-.95,-2.05].forEach(x=>{st.wheels.push(tire(m,.55,.3,x,.55,s*.82,MT.grey,s),tire(m,.55,.3,x,.55,s*1.13,MT.grey,s));});
    fender(m,.66,.48,2.3,.55,s*.92,MT.black);rbox(m,1.9,.05,.62,.02,MT.black,-1.5,1.17,s*.92);
    rail(m,[[-.55,.5,s*1.1],[.6,.5,s*1.1]],.03,MT.grey);});
  cylX(m,.25,.9,MT.white,.55,.72,.78,16);
  rbox(m,.12,.22,2.1,.03,MT.stripes,-2.98,.72,0,.01);[.85,-.85].forEach(z=>rbox(m,.05,.12,.22,.02,MT.tail,-3.05,.92,z,.01));
  const FX=-4.95;
  rbox(S,2.7,.6,.12,.02,MT.wood,FX,.3,1.2);rbox(S,2.7,.6,.12,.02,MT.wood,FX,.3,-1.2);rbox(S,.12,.6,2.4,.02,MT.wood,FX-1.29,.3,0);rbox(S,.12,.6,2.4,.02,MT.wood,FX+1.29,.3,0);
  [1.35,-1.35].forEach(z=>[-.9,.9].forEach(x=>{const st2=rod(S,new V3(FX+x,0,z*1.08),new V3(FX+x,.45,z),.03,MT.wood,5);}));
  const FG=new THREE.BoxGeometry(2.46,1,2.28);FG.translate(0,.5,0);
  const fillMat=toonMat({color:C.wet});const fill=add(S,FG,fillMat,FX,0,0);fill.scale.y=.01;
  const SG=new THREE.CylinderGeometry(.15,.2,1,10);SG.translate(0,-.5,0);
  const stream=add(S,SG,C.wet,-4.72,.98,0);stream.visible=false;
  st.spin=1.2;st.fill=0;st.flow=0;
  part(st,'toupie','la toupie',anchor(tilt,0,1.45,0),true);
  part(st,'goulotte','la goulotte',anchor(chute,-1.1,.35,0),true);
  part(st,'moule','le moule',anchor(S,FX,.9,0),true);
  part(st,'cabine','la cabine',anchor(cab,.8,2.05,0),true);
  st.focus=new V3(-1.4,1.7,0);st.size={w:13,h:7.2};st.tagAt=anchor(S,0,4.8,0);
  st.update=dt=>{roll(st,dt);drum.rotation.x+=st.spin*dt;fill.scale.y=Math.max(.01,st.fill);
    stream.visible=st.flow>.01;if(stream.visible)stream.scale.y=Math.max(.01,(.98-st.fill)*st.flow);};
  st.action=async function(){
    if(st.fill>=.5){await Promise.all([step('Le moule est plein. On en prend un nouveau !','moule'),to(st,'fill',0,1.2)]);fillMat.color.setHex(C.wet);}
    engineOn(58);
    await Promise.all([step('La toupie tourne vite, pour que le béton reste mou.','toupie'),to(st,'spin',7,1.6)]);
    await Promise.all([step('La goulotte se déplie.','goulotte'),to(chute.rotation,'z',.45,1.2)]);
    fillMat.color.setHex(C.wet);
    await Promise.all([step('Le béton coule dans le moule.','moule'),to(st,'flow',1,.35).then(()=>to(st,'fill',Math.min(.52,st.fill+.18),2.8,lin)).then(()=>to(st,'flow',0,.3))]);
    const c0=new THREE.Color(C.wet),c1=new THREE.Color(0xc4c6cf);
    await Promise.all([step('Il va sécher, et devenir dur comme un caillou.','moule'),to(chute.rotation,'z',-1.1,1.2),to(st,'spin',1.2,1.8),tw(2.4,k=>fillMat.color.copy(c0).lerp(c1,k))]);
  };
})();

/* ---- rouleau ---- */
(function(){
  const st=makeStation('rouleau'),S=st.g;
  const X0=-6.5,X1=6.8,RW=2.8,START=-6.6,END=5.4;
  box(S,X1-X0,.06,RW,0x8a7765,(X0+X1)/2,.03,0);
  const AG=new THREE.BoxGeometry(1,.07,RW);AG.translate(.5,0,0);
  const asphalt=add(S,AG,0x8a8478,X0,.07,0);asphalt.scale.x=.001;
  const dashes=[];for(let x=X0+.6;x<X1-.3;x+=1.3){const d=box(S,.7,.02,.14,0xf3efe2,x,.115,0);d.visible=false;dashes.push(d);}
  const N=240,stones=[];
  const gm=new THREE.InstancedMesh(ICO,toonMat({color:0xffffff}),N);gm.castShadow=true;gm.receiveShadow=true;S.add(gm);
  for(let i=0;i<N;i++){const s={x:rnd(X0+.1,X1-.1),z:rnd(-RW/2+.1,RW/2-.1),s:rnd(.1,.2),r:[rnd(0,3),rnd(0,3),rnd(0,3)],flat:false};stones.push(s);gm.setColorAt(i,tmpCol.setHex(pick([0x9a8e80,0x7d7368,0xb3a796,0x6f655c,0xa39a8c])));}
  function writeStones(k){stones.forEach((s,i)=>{const sc=s.flat?.001:s.s*k;dummy.position.set(s.x,.09,s.z);dummy.rotation.set(s.r[0],s.r[1],s.r[2]);dummy.scale.set(sc,sc*.8,sc);dummy.updateMatrix();gm.setMatrixAt(i,dummy.matrix);});gm.instanceMatrix.needsUpdate=true;}
  writeStones(1);
  const m=grp(S,START,0,0);st.m=m;st.lastX=START;
  const drum=grp(m,1.6,.82,0);cylZ(drum,.8,2.1,MT.steel,0,0,0,28);
  [1.07,-1.07].forEach(z=>{cylZ(drum,.82,.06,MT.dark,0,0,z,28);cylZ(drum,.4,.08,MT.yelD,0,0,z*1.03,16);box(drum,.75,.1,.1,MT.dark,0,0,z*1.06);});
  drum.userData.r=.8;
  [1.2,-1.2].forEach(z=>ext(m,[[.7,.35],[2.45,.35],[2.55,1.0],[2.1,1.75],[.7,1.75]],[.05,.15,.3,.2,.05],.12,MT.yel,0,0,z,.02));
  rbox(m,1.6,.3,2.5,.06,MT.yel,1.6,1.82,0);rbox(m,.08,.08,2.25,.02,MT.dark,2.48,.55,0);rbox(m,.08,.08,2.25,.02,MT.dark,.72,.6,0);
  [.6,-.6].forEach(z=>rbox(m,.1,.12,.18,.02,MT.lamp,2.47,1.6,z,.01));
  rbox(m,.6,.55,.85,.06,MT.dark,.45,1.15,0);cylY(m,.1,.75,MT.chrome,.45,1.15,0,10);
  [.35,-.35].forEach(z=>rod(m,new V3(-.1,1.05,z),new V3(.85,1.05,z*1.2),.05,MT.chrome));
  ext(m,[[-2.55,.62],[.05,.62],[.05,1.85],[-1.9,1.85],[-2.55,1.45]],[.05,.05,.1,.25,.2],1.75,MT.yel,0,0,0,.04);
  [1,-1].forEach(s=>{for(let k=0;k<5;k++)box(m,.05,.35,.02,MT.black,-2.15+k*.14,1.35,s*.885);});
  rbox(m,.04,.2,1.2,.02,MT.stripes,-2.58,.9,0,.01);[.65,-.65].forEach(z=>rbox(m,.04,.1,.18,.02,MT.tail,-2.58,1.25,z,.01));
  const cab=grp(m,-.75,1.85,0);
  rbox(cab,1.35,.08,1.5,.03,MT.dark,0,.04,0);
  [[.6,.72],[.6,-.72],[-.6,.72],[-.6,-.72]].forEach(([x,z])=>rbox(cab,.08,1.42,.08,.03,MT.yel,x,.75,z,.01));
  rbox(cab,1.45,.12,1.65,.05,MT.yel,0,1.5,0);
  box(cab,.02,1.2,1.38,MT.glass,.6,.8,0);box(cab,.02,1.2,1.38,MT.glass,-.6,.8,0);box(cab,1.15,1.2,.02,MT.glass,0,.8,.72);box(cab,1.15,1.2,.02,MT.glass,0,.8,-.72);
  rod(cab,new V3(.55,1.2,.72),new V3(.78,1.3,.88),.02,MT.black);rbox(cab,.04,.24,.15,.03,MT.black,.8,1.28,.9);
  [.5,-.5].forEach(z=>rbox(cab,.08,.09,.14,.02,MT.lamp,.65,1.52,z,.01));
  beacon(st,cab,-.4,1.56,.4);
  operator(cab,-.15,.08,0);
  const swh=add(cab,new THREE.TorusGeometry(.17,.025,6,16),MT.black,.32,.6,0);swh.rotation.y=Math.PI/2;swh.rotation.z=.6;rod(cab,new V3(.42,.1,0),new V3(.32,.58,0),.03,MT.black);
  cylY(m,.07,.6,MT.black,-1.9,2.1,-.5,10);
  st.wheels=[tire(m,.78,.62,-1.55,.78,.92,MT.yel),tire(m,.78,.62,-1.55,.78,-.92,MT.yel),drum];
  [1,-1].forEach(s=>fender(m,.86,.68,-1.55,.78,s*.92,MT.yelD));
  part(st,'rouleau','le rouleau',anchor(drum,0,1.25,0),true);
  part(st,'cabine','la cabine',anchor(m,-.75,3.6,0),true);
  part(st,'cailloux','les cailloux',anchor(S,2.5,.5,0),false);
  part(st,'route','la route',anchor(S,0,.4,0),false);
  st.focus=new V3(0,1.1,0);st.size={w:15,h:6.5};st.tagAt=anchor(S,0,4.6,0);
  let T=0;
  st.update=dt=>{T+=dt;roll(st,dt);const front=m.position.x+1.6;
    if(st.rolling){let dirty=false;stones.forEach(s=>{if(!s.flat&&s.x<front){s.flat=true;dirty=true;}});if(dirty)writeStones(1);
      const len=clamp(front-X0,.001,X1-X0);asphalt.scale.x=len;dashes.forEach(d=>d.visible=false);
      drum.position.y=.82+Math.sin(T*70)*.025;}else drum.position.y=.82;};
  st.action=async function(){
    if(st.done){
      engineOn(52);st.reversing=true;st.beepT=0;
      stones.forEach(s=>s.flat=false);asphalt.scale.x=.001;dashes.forEach(d=>d.visible=false);
      await Promise.all([step('On remet des cailloux pour une nouvelle route.','cailloux'),to(m.position,'x',START,2.6),tw(1,k=>writeStones(Math.max(.01,k)),easeBack)]);
      st.reversing=false;st.done=false;
    }
    engineOn(52);st.rolling=true;
    await Promise.all([to(m.position,'x',END,5.6,easeSine),(async()=>{await step('Le gros rouleau roule sur les cailloux.','rouleau');await step('Il vibre très fort pour bien les écraser.','rouleau');})()]);
    st.rolling=false;
    await step('Les cailloux sont bien tassés : la route sera solide !','route');
    st.done=true;
  };
})();

/* ---- dumper ---- */
(function(){
  const st=makeStation('dumper'),S=st.g,m=grp(S);st.m=m;
  const GRAV=0x9a8e80;
  rbox(m,3.0,.32,.9,.06,MT.dark,-.1,.82,0);
  // rear unit: engine, seat, roll bar
  rbox(m,1.25,.72,1.3,.14,MT.yel,-1.0,1.25,0);for(let k=0;k<5;k++)box(m,.04,.36,.02,MT.black,-1.4+k*.18,1.28,.66);
  rbox(m,.06,.2,1.0,.02,MT.stripes,-1.64,1.0,0,.01);[.5,-.5].forEach(z=>rbox(m,.04,.1,.16,.02,MT.tail,-1.64,1.3,z,.01));
  rbox(m,.5,.1,.5,.04,MT.black,-.75,1.65,0);rbox(m,.1,.5,.5,.04,MT.black,-1.0,1.9,0);
  rail(m,[[-1.25,1.6,.62],[-1.25,2.75,.62],[-1.25,2.75,-.62],[-1.25,1.6,-.62]],.05,MT.yel);
  rod(m,new V3(-.2,1.4,0),new V3(-.4,1.9,0),.03,MT.black);const swh=add(m,new THREE.TorusGeometry(.17,.025,6,16),MT.black,-.42,1.95,0);swh.rotation.y=Math.PI/2;swh.rotation.z=.9;
  operator(m,-.85,1.62,0);
  beacon(st,m,-1.25,2.8,0);
  cylY(m,.06,.5,MT.black,-1.4,1.85,-.45,10);
  // front unit and the skip
  rbox(m,1.3,.4,1.1,.08,MT.yelD,.75,1.0,0);
  const skip=grp(m,1.6,1.2,0);
  ext(skip,[[-1.5,.02],[0,.02],[.32,.95],[.3,1.05],[-1.62,1.08]],.06,1.6,MT.yel,0,0,0,.02);
  rbox(skip,1.5,.06,1.62,.02,MT.yelD,-.75,.02,0,.01);
  const load=grp(skip,0,0,0);rbox(load,1.55,.22,1.45,.1,mat(GRAV),-.62,1.0,0);
  [[-1.0,1.15,.3,.45],[-.4,1.18,-.3,.5],[-.7,1.2,0,.55]].forEach(([x,y,z,s])=>{const l=add(load,ICO,0x8a7d70,x,y,z);l.scale.set(s,s*.5,s);});
  st.links=[hydraulic(m,anchor(m,.2,.95,.3),anchor(skip,-1.1,.15,.3),{barrel:.55,rb:.07}),hydraulic(m,anchor(m,.2,.95,-.3),anchor(skip,-1.1,.15,-.3),{barrel:.55,rb:.07})];
  st.wheels=[];[1,-1].forEach(s=>{st.wheels.push(tire(m,.55,.45,1.05,.55,s*.72,MT.yel),tire(m,.55,.45,-1.05,.55,s*.72,MT.yel));fender(m,.66,.5,-1.05,.55,s*.74,MT.yelD,Math.PI*.7);});
  const pl=pile(S,8.0,0,.45,GRAV);
  part(st,'benne','la benne',anchor(skip,-.6,1.3,0),true);
  part(st,'conducteur','le conducteur',anchor(m,-.85,2.4,.3),true);
  part(st,'roues','les roues',anchor(m,1.05,.6,.9),true);
  part(st,'tas','le tas de cailloux',anchor(pl,0,1.2,0),false);
  st.focus=new V3(2.6,1.3,0);st.size={w:12,h:6.5};st.tagAt=anchor(S,0,4.2,0);
  st.update=dt=>roll(st,dt);
  st.action=async function(){
    engineOn(70);
    await Promise.all([step('Le dumper roule avec sa benne pleine de cailloux.','roues'),to(m.position,'x',4.6,3.2,easeSine)]);
    let sent=0;const target=wp(pl,.4);
    await Promise.all([step('Sa benne bascule vers l’avant...','benne'),to(skip.rotation,'z',-1.55,1.5),
      sleep(.8).then(()=>tw(1.0,k=>{load.position.x=k*.6;const want=Math.floor(k*14);while(sent<want){throwClod(wp(skip,.9).add(new V3(0,0,0)),target,rnd(.12,.22),pick([0x9a8e80,0x7d7368,0xb3a796]));sent++;}},lin))]);
    load.visible=false;thud();
    const s0=pl.scale.x,s1=Math.min(1.1,s0+.18);
    await Promise.all([step('...et les cailloux tombent sur le tas.','tas'),tw(.9,k=>pl.scale.setScalar(s0+(s1-s0)*k))]);
    await Promise.all([step('La benne se remet en place, et le dumper repart.','benne'),to(skip.rotation,'z',0,1.4)]);
    st.reversing=true;st.beepT=0;await to(m.position,'x',0,2.8,easeSine);st.reversing=false;
    load.position.x=0;load.visible=true;pop(load,.5);
    if(pl.scale.x>=1.05)tw(1,k=>pl.scale.setScalar(Math.max(.45,1.1-k*.65)));
  };
})();

/* ---- chargeuse ---- */
(function(){
  const st=makeStation('chargeuse'),S=st.g,m=grp(S);st.m=m;
  const GRAV=0x9a8e80,R=.82;
  rbox(m,4.3,.5,1.0,.08,MT.dark,-.2,.95,0);
  // rear frame: engine and counterweight
  rbox(m,2.0,.95,1.5,.16,MT.yel,-1.55,1.55,0);rbox(m,.4,.9,1.6,.12,MT.yelD,-2.65,1.25,0);
  for(let k=0;k<6;k++)box(m,.04,.5,.02,MT.black,-2.3+k*.2,1.6,.76);
  rbox(m,.05,.22,1.2,.02,MT.stripes,-2.86,.95,0,.01);[.6,-.6].forEach(z=>rbox(m,.04,.1,.18,.02,MT.tail,-2.86,1.45,z,.01));
  cylY(m,.08,.7,MT.black,-1.9,2.3,-.45,10);
  rail(m,[[-2.5,2.03,.7],[-2.5,2.35,.7],[-.95,2.35,.7]],.025,MT.yel);
  const cab=grp(m,-.35,1.35,0);
  rbox(cab,1.4,.1,1.4,.03,MT.dark,0,.05,0);
  [[.62,.62],[.62,-.62],[-.62,.62],[-.62,-.62]].forEach(([x,z])=>rbox(cab,.09,1.55,.09,.03,MT.yel,x,.8,z,.01));
  rbox(cab,1.55,.14,1.55,.06,MT.yel,0,1.62,0);
  box(cab,.02,1.25,1.2,MT.glass,.62,.85,0);box(cab,.02,1.25,1.2,MT.glass,-.62,.85,0);box(cab,1.2,1.25,.02,MT.glass,0,.85,.62);box(cab,1.2,1.25,.02,MT.glass,0,.85,-.62);
  [.45,-.45].forEach(z=>rbox(cab,.08,.09,.14,.02,MT.lamp,.7,1.62,z,.01));
  operator(cab,-.12,.1,0);beacon(st,cab,-.4,1.7,.4);
  // front frame with the articulation
  rbox(m,1.3,.6,1.0,.08,MT.yel,1.35,1.15,0);cylY(m,.2,.5,MT.dark,.6,1.05,0,14);
  st.wheels=[];
  [1,-1].forEach(s=>{st.wheels.push(tire(m,R,.62,1.55,R,s*1.02,MT.yel),tire(m,R,.62,-1.55,R,s*1.02,MT.yel));
    fender(m,.96,.7,1.55,R,s*1.04,MT.yelD,Math.PI*.65);fender(m,.96,.7,-1.55,R,s*1.04,MT.yelD,Math.PI*.65);});
  // lift arms and bucket
  const arm=grp(m,.95,1.75,0);
  [.66,-.66].forEach(z=>ext(arm,[[-.18,.18],[1.15,.08],[2.55,-1.15],[2.4,-1.48],[1.05,-.28],[-.18,-.22]],.08,.16,MT.yel,0,0,z,.02));
  cylZ(arm,.1,1.45,MT.yelD,1.2,-.12,0,12);cylZ(arm,.12,1.6,MT.chrome,0,0,0,12);
  const bucket=grp(arm,2.45,-1.32,0);
  rbox(bucket,.12,1.05,2.5,.04,MT.yelD,-.05,.0,0,.02);
  rbox(bucket,1.1,.1,2.5,.03,MT.yelD,.48,-.44,0,.01);
  [1.25,-1.25].forEach(z=>ext(bucket,[[-.1,.52],[-.1,-.48],[1.05,-.48],[.2,.25]],0,.06,MT.yelD,0,0,z,.01));
  rbox(bucket,.16,.07,2.55,.02,MT.steel,1.05,-.46,0,.01);
  const TOOTH=new THREE.ConeGeometry(.05,.2,4);TOOTH.rotateZ(-Math.PI/2);for(let i=-4;i<=4;i++)add(bucket,TOOTH,MT.steel,1.18,-.45,i*.28);
  const load=grp(bucket,0,0,0);[[.35,-.2,.5,.55],[.5,-.15,-.4,.6],[.3,-.1,0,.65]].forEach(([x,y,z,s])=>{const l=add(load,ICO,GRAV,x,y,z);l.scale.set(s,s*.6,s);});load.visible=false;
  st.links=[
    hydraulic(m,anchor(m,1.55,.95,.42),anchor(arm,1.3,-.5,.42),{barrel:.85,rb:.09}),hydraulic(m,anchor(m,1.55,.95,-.42),anchor(arm,1.3,-.5,-.42),{barrel:.85,rb:.09}),
    hydraulic(m,anchor(m,1.6,1.75,0),anchor(bucket,-.08,.42,0),{barrel:1.0,rb:.08})];
  // the gravel pile in front, the truck to fill behind
  const pl=pile(S,5.7,0,1.55,GRAV);
  const truck=miniCar(S,'truck',0x2f7de0);truck.scale.setScalar(1.3);truck.rotation.y=Math.PI/2;truck.position.set(-7.0,0,-1.0);
  const tload=grp(S,-7.0,2.05,0);[[0,0,0,.9],[.3,.1,.4,.7],[-.3,.05,-.4,.75]].forEach(([x,y,z,s])=>{const l=add(tload,ICO,GRAV,x,y,z);l.scale.set(s,s*.45,s*1.2);});tload.scale.setScalar(.01);tload.visible=false;
  part(st,'godet','le godet',anchor(bucket,.6,.4,0),true);
  part(st,'bras','les bras',anchor(arm,1.6,-.4,.7),true);
  part(st,'roues','les grosses roues',anchor(m,-1.55,.8,1.4),true);
  part(st,'tas','le tas de cailloux',anchor(pl,0,1.3,0),false);
  part(st,'camion','le camion',anchor(S,-7.0,2.6,0),false);
  st.focus=new V3(-.8,1.6,0);st.size={w:16,h:8};st.tagAt=anchor(S,0,4.6,0);
  const prev=new V3();prev.copy(m.position);
  const setPose=(a,b)=>{arm.rotation.z=a;bucket.rotation.z=b;};
  st.update=dt=>{
    const dx=m.position.x-prev.x,dz=m.position.z-prev.z,ry=m.rotation.y,d=dx*Math.cos(ry)-dz*Math.sin(ry);prev.copy(m.position);
    if(d)st.wheels.forEach(w=>w.rotation.z-=d/R);st.links.forEach(l=>l.update());
    if(st.reversing){st.beepT-=dt;}
  };
  st.loads=0;
  st.action=async function(){
    engineOn(60);
    if(st.loads>=3){await Promise.all([step('Le camion est plein ! On le vide pour recommencer.','camion'),tw(1,k=>tload.scale.setScalar(Math.max(.01,1-k)))]);tload.visible=false;st.loads=0;}
    {const a0=arm.rotation.z,b0=bucket.rotation.z;await Promise.all([step('La chargeuse baisse son godet tout près du sol.','godet'),tw(.8,k=>setPose(a0*(1-k),b0*(1-k)))]);}
    let n=0;const front=()=>wp(bucket,0).add(new V3(0,.2,0));
    await Promise.all([step('Elle fonce dans le tas de cailloux !','roues'),to(m.position,'x',1.5,2.2,easeIn),
      sleep(1.4).then(()=>tw(.8,k=>{if(++n%3===0)throwClod(front(),front().add(new V3(rnd(-.5,.5),.6,rnd(-1,1))),rnd(.1,.2),GRAV);pl.scale.setScalar(1.55-k*.08);},lin))]);
    load.visible=true;
    await Promise.all([step('Le godet se relève : il est plein de cailloux.','godet'),tw(1.2,k=>setPose(.25*k,.75*k))]);
    st.reversing=true;
    await Promise.all([step('Elle recule et fait demi-tour.','roues'),tw(3.4,k=>{m.position.x=1.5*(1-k);m.position.z=Math.sin(k*Math.PI)*2.8;m.rotation.y=Math.PI*k;},easeSine)]);
    st.reversing=false;
    await Promise.all([step('Les bras lèvent le godet tout en haut.','bras'),tw(1.8,k=>setPose(.25+.92*k,.75-.95*k)),to(m.position,'x',-2.2,1.8,easeSine)]);
    tload.visible=true;
    let sent=0;const tgt=wp(tload,0);
    await Promise.all([step('Et hop ! Les cailloux tombent dans le camion.','camion'),to(bucket.rotation,'z',-1.25,1.0),
      sleep(.4).then(()=>tw(.9,k=>{const want=Math.floor(k*14);while(sent<want){throwClod(wp(bucket,-.2),tgt,rnd(.12,.22),GRAV);sent++;}},lin))]);
    load.visible=false;thud();st.loads++;
    const s0=tload.scale.x,s1=Math.min(1,.4+st.loads*.3);tw(.8,k=>tload.scale.setScalar(Math.max(.01,s0+(s1-s0)*k)));
    await Promise.all([step('Elle recule, et repart chercher des cailloux.','roues'),to(m.position,'x',0,1.6,easeSine),tw(1.6,k=>setPose(1.17*(1-k),-1.25*(1-k)))]);
    await tw(3.0,k=>{m.position.z=-Math.sin(k*Math.PI)*2.2;m.rotation.y=Math.PI*(1+k);},easeSine);
    m.rotation.y=0;m.position.set(0,0,0);prev.copy(m.position);
    pl.scale.setScalar(1.55);
  };
})();

/* ---- nacelle ---- */
(function(){
  const st=makeStation('nacelle'),S=st.g,m=grp(S);st.m=m;
  const WALL=-1.25,FH=2.4,FLOORS=4,BW=10,BD=6;
  // the block of flats the nacelle works on
  const bld=grp(S,0,0,WALL-BD/2);
  const wallM=std(0xf3e2c6,.8,0),trimM=std(0xd98a5a,.7,0);
  rbox(bld,BW,.3,BD,.04,MT.concrete,0,.15,0);
  for(let f=0;f<FLOORS;f++){
    const y=.3+f*FH;
    rbox(bld,BW,FH-.2,BD,.03,f%2?wallM:std(0xf6ead6,.8,0),0,y+(FH-.2)/2,0);
    rbox(bld,BW+.2,.2,BD+.2,.03,trimM,0,y+FH-.1,0);
    [-4.2,-2.4,2.4,4.2].forEach(x=>{if(f===0&&Math.abs(x)<3)return;rbox(bld,1.1,1.2,.12,.03,MT.white,x,y+1.15,BD/2,.01);box(bld,.9,1.0,.06,MT.glassD,x,y+1.15,BD/2+.05);});
    if(f>0){const hole=box(bld,1.1,1.25,.1,0x1d2130,0,y+1.15,BD/2+.01);hole.userData.f=f;}
    [-3.3,3.3].forEach(x=>{if(f>0){rbox(bld,1.6,.1,.8,.02,MT.concrete,x,y+.05,BD/2+.4,.01);rail(bld,[[x-.8,y+.1,BD/2+.8],[x-.8,y+.9,BD/2+.8],[x+.8,y+.9,BD/2+.8],[x+.8,y+.1,BD/2+.8]],.025,MT.dark);}});
  }
  rbox(bld,BW+.4,.4,BD+.4,.06,std(0x5a5f78,.8,0),0,.3+FLOORS*FH+.2,0);
  rbox(bld,1.6,2.0,.2,.04,trimM,0,1.3,BD/2+.05);box(bld,1.2,1.7,.06,std(0x6a3f2a,.7,0),0,1.2,BD/2+.12);
  // the windows the worker will fit
  const wins=[1,2,3].map(f=>{const w=grp(S,0,.3+f*FH+1.15,WALL+.06);rbox(w,1.1,1.2,.12,.03,MT.white,0,0,0,.01);box(w,.9,1.0,.06,MT.glass,0,0,.04);box(w,.06,1.0,.07,MT.white,0,0,.05);w.visible=false;return w;});
  // chassis
  rbox(m,2.5,.45,1.2,.1,MT.orange,0,.55,0);rbox(m,2.3,.25,1.0,.05,MT.dark,0,.26,0);
  rbox(m,.35,.5,.5,.05,MT.dark,-1.0,.95,.3);rbox(m,.06,.12,1.0,.02,MT.stripes,1.26,.55,0,.01);
  st.wheels=[];[[.85,.55],[.85,-.55],[-.85,.55],[-.85,-.55]].forEach(([x,z])=>st.wheels.push(tire(m,.28,.2,x,.28,z,MT.grey)));
  // scissor arms
  const Lb=1.9,N=4,Y0=.85,bars=[];
  const BARG=new THREE.BoxGeometry(1,.1,.08);
  for(let i=0;i<N;i++)[.5,-.5].forEach(z=>{bars.push({a:add(m,BARG,MT.orange,0,0,z),b:add(m,BARG,MT.orangeD,0,0,z*.86),i});});
  const pins=[];for(let i=0;i<N;i++)pins.push(cylZ(m,.07,1.1,MT.dark,0,0,0,10));
  const plat=grp(m,0,0,0);
  rbox(plat,2.7,.14,1.3,.04,MT.orange,0,0,0);rbox(plat,2.7,.06,1.32,.02,MT.dark,0,.08,0);
  [[.62],[-.62]].forEach(([z])=>rail(plat,[[-1.3,.1,z],[-1.3,1.1,z],[1.3,1.1,z],[1.3,.1,z]],.03,MT.yel));
  rail(plat,[[1.3,1.1,.62],[1.3,1.1,-.62]],.03,MT.yel);rail(plat,[[-1.3,1.1,.62],[-1.3,1.1,-.62]],.03,MT.yel);rail(plat,[[-1.3,.6,.62],[1.3,.6,.62]],.025,MT.yel);
  rbox(plat,.3,.4,.25,.04,MT.dark,-1.05,.3,.4);
  const man=person(plat,.3,0,{vest:true,hat:MT.hat});man.position.set(.3,.08,-.2);man.rotation.y=Math.PI/2;
  const drill=rbox(man.userData.arms[0],.1,.1,.32,.03,std(0x2f7de0,.5,.1),0,-.38,.15);
  let theta=.1;
  const setLift=th=>{theta=th;const h=Lb*Math.sin(th),s=Lb*Math.cos(th),ang=Math.atan2(h,s);
    bars.forEach(({a,b,i})=>{const y=Y0+i*h+h/2;a.position.set(0,y,a.position.z);a.rotation.z=ang;a.scale.x=Lb;b.position.set(0,y,b.position.z);b.rotation.z=-ang;b.scale.x=Lb;});
    pins.forEach((p,i)=>p.position.set(0,Y0+i*h+h/2,0));plat.position.y=Y0+N*h+.07;};
  setLift(.1);
  part(st,'ciseaux','les bras en ciseaux',anchor(pins[1],0,0,.6),true);
  part(st,'plateforme','la plateforme',anchor(plat,-1.2,1.2,.6),true);
  part(st,'ouvrier',"l'ouvrier",anchor(man,0,1.5,0),false);
  const winA=anchor(S,.6,0,WALL+.2);part(st,'fenetre','la fenêtre',winA,false);
  part(st,'immeuble',"l'immeuble",anchor(bld,-3.3,FLOORS*FH,BD/2),true);
  st.focus=new V3(0,4.8,0);st.size={w:13,h:12};st.tagAt=anchor(S,0,11.6,1);
  st.n=0;
  const liftTo=(y,d)=>{const th=Math.asin(Math.min(.98,(y-Y0-.07)/(N*Lb)));const t0=theta;return tw(d,k=>setLift(t0+(th-t0)*k));};
  st.action=async function(){
    if(st.n>=wins.length){await Promise.all([step('Toutes les fenêtres sont posées ! On recommence.','immeuble'),tw(.6,k=>wins.forEach(w=>w.scale.setScalar(Math.max(.01,1-k))))]);wins.forEach(w=>{w.visible=false;w.scale.setScalar(1);});st.n=0;}
    const w=wins[st.n];winA.position.set(.6,w.position.y,WALL+.2);
    engineOn(120);
    await Promise.all([step('La nacelle monte : ses bras se déplient comme des ciseaux.','ciseaux'),liftTo(w.position.y-1.2,3.2+st.n*.6)]);
    await Promise.all([step("L'ouvrier pose une fenêtre toute neuve.",'ouvrier'),to(man.userData.arms[0].rotation,'z',1.2,.6),to(man.userData.arms[1].rotation,'z',1.2,.6)]);
    w.visible=true;pop(w,.5);ding();
    await Promise.all([step('Il la fixe avec sa visseuse. Bzz, bzz !','fenetre'),to(man.userData.arms[1].rotation,'z',0,.4),tw(1.6,k=>{drill.rotation.x+=.5;})]);
    await to(man.userData.arms[0].rotation,'z',0,.4);
    await Promise.all([step('Et la nacelle redescend doucement.','plateforme'),liftTo(Y0+.07+N*Lb*Math.sin(.1),3.0)]);
    st.n++;
  };
})();

/* ---- niveleuse ---- */
(function(){
  const st=makeStation('niveleuse'),S=st.g,X0=-6.5,X1=6.5,RW=3.4,START=-3,END=3,GRAV=0x9a8e80;
  box(S,X1-X0,.05,RW,0x8a6a52,0,.025,0);
  const flat=add(S,(()=>{const g=new THREE.BoxGeometry(1,.1,RW);g.translate(.5,0,0);return g;})(),mat(0xa89a88),X0,.06,0);flat.scale.x=.001;
  const heaps=[];[-4.5,-1.5,1.5,4.5].forEach(cx=>{for(let i=0;i<34;i++){const a=rnd(0,6.28),r=Math.sqrt(Math.random())*1.1;heaps.push({x:cx+Math.cos(a)*r,y:.1+(1.1-r)*.35,z:Math.sin(a)*r*1.2,s:rnd(.16,.28),k:1});}});
  const hm=new THREE.InstancedMesh(ICO,toonMat({color:0xffffff}),heaps.length);hm.castShadow=hm.receiveShadow=true;S.add(hm);
  heaps.forEach((h,i)=>hm.setColorAt(i,tmpCol.setHex(pick([0x9a8e80,0x7d7368,0xb3a796,0x8a8070]))));
  const writeH=()=>{heaps.forEach((h,i)=>{const s=h.s*Math.max(.001,h.k);dummy.position.set(h.x,h.y*h.k,h.z);dummy.rotation.set(h.x,h.z,0);dummy.scale.set(s,s*.8,s);dummy.updateMatrix();hm.setMatrixAt(i,dummy.matrix);});hm.instanceMatrix.needsUpdate=true;};writeH();
  const m=grp(S,START,0,0);st.m=m;st.lastX=START;
  // rear: engine and cab on two pairs of wheels
  rbox(m,2.4,.85,1.5,.14,MT.yel,-2.2,1.25,0);for(let k=0;k<5;k++)box(m,.04,.4,.02,MT.black,-2.9+k*.18,1.3,.76);
  rbox(m,.06,.2,1.1,.02,MT.stripes,-3.42,.9,0,.01);[.55,-.55].forEach(z=>rbox(m,.04,.1,.16,.02,MT.tail,-3.42,1.35,z,.01));
  rbox(m,3.6,.35,.8,.06,MT.dark,-1.8,.75,0);cylY(m,.07,.6,MT.black,-2.8,1.95,-.4,10);
  const cab=grp(m,-.75,1.25,0);rbox(cab,1.35,.1,1.4,.03,MT.dark,0,.05,0);[[.6,.62],[.6,-.62],[-.6,.62],[-.6,-.62]].forEach(([x,z])=>rbox(cab,.08,1.5,.08,.03,MT.yel,x,.78,z,.01));
  rbox(cab,1.5,.12,1.55,.05,MT.yel,0,1.56,0);box(cab,.02,1.25,1.2,MT.glass,.6,.8,0);box(cab,1.15,1.25,.02,MT.glass,0,.8,.62);box(cab,1.15,1.25,.02,MT.glass,0,.8,-.62);box(cab,.02,1.25,1.2,MT.glass,-.6,.8,0);
  operator(cab,-.1,.1,0);beacon(st,cab,-.4,1.62,.4);
  st.wheels=[];[1,-1].forEach(s=>{[-1.55,-2.75].forEach(x=>st.wheels.push(tire(m,.55,.4,x,.55,s*1.0,MT.yel,s)));st.wheels.push(tire(m,.55,.36,3.3,.55,s*.92,MT.yel,s));});
  // the long neck to the front wheels
  beam(m,new V3(-.2,1.45,0),new V3(1.5,1.9,0),.42,MT.yel);beam(m,new V3(1.5,1.9,0),new V3(3.3,1.15,0),.38,MT.yel);rbox(m,.5,.3,1.6,.06,MT.yel,3.3,.95,0);
  [.35,-.35].forEach(z=>rbox(m,.05,.1,.14,.02,MT.lamp,3.56,1.05,z,.01));
  // blade under the middle, slightly turned
  const bladeG=grp(m,.9,.62,0);bladeG.rotation.y=.42;
  const bo=arc(.0,.3,.55,150,215,10),bi=arc(.0,.3,.47,215,150,10);ext(bladeG,bo.concat(bi),0,3.5,MT.yelD,0,-.2,0,.02);rbox(bladeG,.08,.06,3.5,.02,MT.steel,-.47,-.42,0,.01);
  rod(m,new V3(3.1,.85,0),new V3(.9,.85,0),.07,MT.dark,8);cylY(m,.55,.06,MT.dark,.9,.85,0,20);
  st.links=[hydraulic(m,anchor(m,1.4,1.85,.45),anchor(bladeG,-.3,.25,.9),{barrel:.55,rb:.07}),hydraulic(m,anchor(m,1.4,1.85,-.45),anchor(bladeG,-.3,.25,-.9),{barrel:.55,rb:.07})];
  part(st,'lame','la longue lame',anchor(bladeG,-.3,.2,1.6),true);
  part(st,'cou','le long cou',anchor(m,1.6,2.2,0),true);
  part(st,'cailloux','les tas de cailloux',anchor(S,4.5,.8,0),false);
  part(st,'cabine','la cabine',anchor(cab,0,1.8,0),true);
  st.focusAt=anchor(m,0,1.2,0);st.size={w:14,h:6.5};st.tagAt=anchor(m,0,3.6,0);
  st.update=dt=>{roll(st,dt);if(st.grading){const bx=m.position.x+.9+.75;let d=false;heaps.forEach(h=>{if(h.k>0&&h.x<bx){h.k=Math.max(0,h.k-dt*6);d=true;}});if(d)writeH();flat.scale.x=clamp(bx-X0,.001,X1-X0);}};
  st.action=async function(){
    if(st.done){engineOn(52);st.reversing=true;st.beepT=0;
      await Promise.all([step('Un camion a vidé de nouveaux tas de cailloux.','cailloux'),to(m.position,'x',START,2.6),tw(1,k=>{heaps.forEach(h=>h.k=k);writeH();flat.scale.x=Math.max(.001,flat.scale.x*(1-k));})]);
      st.reversing=false;st.done=false;}
    engineOn(55);
    flat.scale.x=clamp(m.position.x+1.65-X0,.001,X1-X0);
    await Promise.all([step('La niveleuse baisse sa longue lame.','lame'),to(bladeG.position,'y',.5,1.0)]);
    st.grading=true;
    await Promise.all([to(m.position,'x',END,6.5,easeSine),(async()=>{await step('Sa lame étale les cailloux bien à plat.','lame');await step('Son long cou l’aide à faire une route bien droite.','cou');})()]);
    st.grading=false;
    await Promise.all([step('La lame remonte. Maintenant, on peut tasser !','lame'),to(bladeG.position,'y',.62,.8)]);
    st.done=true;
  };
})();

/* ---- finisseur + rouleau tandem ---- */
(function(){
  const st=makeStation('finisseur'),S=st.g,X0=-7,X1=6.5,RW=3.4,START=-3.2,END=5.2,BEHIND=4.9;
  box(S,X1-X0,.05,RW,0x8a8478,(X0+X1)/2,.025,0);
  const AG=new THREE.BoxGeometry(1,.08,RW);AG.translate(.5,0,0);
  const fresh=add(S,AG,mat(0x3a3a46),X0,.07,0);fresh.scale.x=.001;
  const smooth=add(S,AG,mat(C.asphalt),X0,.075,0);smooth.scale.x=.001;
  const dashes=[];for(let x=X0+.6;x<X1-.3;x+=1.4){const d=box(S,.7,.02,.14,0xf3efe2,x,.12,0);d.visible=false;dashes.push(d);}
  // the paver: tracks, hopper in front, driver platform, wide screed behind
  const m=grp(S,START,0,0);st.m=m;st.lastX=START;
  st.tracks=[trackUnit(m,{len:2.4,r:.32,w:.45,z:1.0}),trackUnit(m,{len:2.4,r:.32,w:.45,z:-1.0})];
  rbox(m,2.6,.7,2.0,.1,MT.yel,-.2,1.05,0);rbox(m,1.0,.5,1.8,.08,MT.dark,-.7,1.6,0);
  const hop=grp(m,1.55,.95,0);rbox(hop,1.2,.12,2.4,.03,MT.yelD,0,0,0);[1.2,-1.2].forEach(z=>{const w=grp(hop,0,0,z);ext(w,[[-.6,0],[.6,0],[.6,.6],[-.6,.5]],.03,.08,MT.yel,0,0,0,.01);});rbox(hop,.08,.55,2.4,.02,MT.yel,.6,.28,0);
  const load=grp(hop,0,.15,0);[[0,0,.5,.6],[-.2,.05,-.5,.55],[.2,0,0,.65]].forEach(([x,y,z,s])=>{const l=add(load,ICO,0x26262e,x,y,z);l.scale.set(s,s*.45,s);});
  rbox(m,1.2,.1,2.1,.03,MT.dark,-1.2,1.88,0);[[-.6,.95],[-.6,-.95],[-1.8,.95],[-1.8,-.95]].forEach(([x,z])=>cylY(m,.04,1.4,MT.dark,x,2.6,z,6));rbox(m,1.6,.08,2.2,.03,std(0xf2f2f6,.6,0),-1.2,3.32,0);
  const drv=operator(m,-1.3,1.95,.4);drv.rotation.y=Math.PI/2;
  const screed=grp(m,-1.8,.1,0);rbox(screed,.6,.4,3.4,.06,MT.yel,0,.2,0);rbox(screed,.62,.08,3.42,.02,MT.dark,0,.02,0);rail(screed,[[-.3,.45,1.7],[-.3,.85,1.7],[-.3,.85,-1.7],[-.3,.45,-1.7]],.025,MT.yel);
  beacon(st,m,-.4,3.4,0);
  // the tandem roller that follows
  const r=grp(S,START-BEHIND,0,0);const RR=.5,drums=[];
  [1.0,-1.0].forEach(x=>{const d=grp(r,x,RR,0);cylZ(d,RR,1.8,MT.steel,0,0,0,24);[.92,-.92].forEach(z=>cylZ(d,RR+.02,.05,MT.dark,0,0,z,24));drums.push(d);});
  rbox(r,1.2,.5,1.6,.08,MT.yel,0,1.15,0);[1,-1].forEach(s=>{rbox(r,2.6,.35,.12,.04,MT.yel,0,1.0,s*.95);});
  const rcab=grp(r,0,1.4,0);[[.4,.45],[.4,-.45],[-.4,.45],[-.4,-.45]].forEach(([x,z])=>cylY(rcab,.03,1.2,MT.dark,x,.6,z,6));rbox(rcab,1.1,.08,1.1,.03,std(0xf2f2f6,.6,0),0,1.2,0);
  const rdrv=operator(rcab,-.1,0,0);beacon(st,rcab,0,1.25,0);
  part(st,'tremie','la trémie',anchor(hop,0,.7,1.0),true);
  part(st,'table','la table qui lisse',anchor(screed,0,.5,1.4),true);
  part(st,'enrobe',"l'enrobé tout chaud",anchor(S,X0+1.5,.4,0),false);
  part(st,'tandem','le rouleau tandem',anchor(r,0,2.9,0),true);
  st.focusAt=anchor(m,-2.2,1.2,0);st.size={w:15,h:7};st.tagAt=anchor(m,0,4.2,0);
  let T=0,steam=0;
  st.update=dt=>{T+=dt;roll(st,dt);
    const rx=r.position.x,dr=rx-(st.rLast??rx);st.rLast=rx;if(dr)drums.forEach(d=>d.rotation.z-=dr/RR);
    if(st.paving){const back=m.position.x-2.1;fresh.scale.x=clamp(back-X0,.001,X1-X0);steam-=dt;if(steam<=0){steam=.12;fx.smoke(W(S,back-rnd(0,2),.3,rnd(-1.4,1.4)),new V3(0,rnd(.6,1.2),0),rnd(.25,.45),0xe8e8f0,1.4);}}
    const sx=clamp(r.position.x+1.5-X0,.001,X1-X0);if(st.rolling){smooth.scale.x=Math.max(smooth.scale.x,sx);drums.forEach(d=>d.position.y=RR+Math.sin(T*60)*.015);}
  };
  const W=(o,x,y,z)=>o.localToWorld(new V3(x,y,z));
  st.action=async function(){
    if(st.done){engineOn(48);st.reversing=true;st.beepT=0;
      await Promise.all([step('On prépare un nouveau bout de route.','enrobe'),to(m.position,'x',START,2.6),to(r.position,'x',START-BEHIND,2.6),tw(1,k=>{fresh.scale.x=Math.max(.001,fresh.scale.x*(1-k));smooth.scale.x=Math.max(.001,smooth.scale.x*(1-k));})]);
      dashes.forEach(d=>d.visible=false);load.visible=true;st.reversing=false;st.done=false;}
    engineOn(45);
    load.scale.setScalar(.01);load.visible=true;
    await Promise.all([step('Un camion verse l’enrobé tout chaud dans la trémie.','tremie'),tw(1.4,k=>load.scale.setScalar(Math.max(.01,k)),easeBack),
      tw(1.4,k=>{if(Math.random()<.3)fx.smoke(wp(hop,.6),new V3(0,1,0),.4,0xe8e8f0,1.2);},lin)]);
    st.paving=true;st.rolling=true;
    await Promise.all([to(m.position,'x',END,8,lin),to(r.position,'x',END-BEHIND+.4,8,lin),tw(8,k=>load.scale.setScalar(Math.max(.2,1-k*.8)),lin),
      (async()=>{await step('Le finisseur avance, et étale l’enrobé derrière lui.','table');await step('Sa table chauffe et lisse le goudron.','table');await step('Le rouleau tandem suit, et écrase tout bien à plat.','tandem');})()]);
    st.paving=false;st.rolling=false;smooth.scale.x=clamp(r.position.x+1.5-X0,.001,X1-X0);
    await Promise.all([step('Il reste à peindre les lignes. Voilà la nouvelle route !','enrobe'),tw(1,k=>dashes.forEach((d,i)=>d.visible=d.position.x<X0+smooth.scale.x-.4&&k*dashes.length>i))]);
    st.done=true;
  };
})();

/* ---- tractopelle ---- */
(function(){
  const st=makeStation('tractopelle'),S=st.g,TZ=-2.1;
  const m=grp(S,0,0,0);st.m=m;
  rbox(m,3.6,.5,1.2,.08,MT.dark,0,.95,0);
  rbox(m,1.7,.9,1.4,.14,MT.yel,1.0,1.55,0);for(let k=0;k<5;k++)box(m,.04,.4,.02,MT.black,.5+k*.2,1.55,.71);
  const cab=grp(m,-.75,1.2,0);rbox(cab,1.4,.1,1.45,.03,MT.dark,0,.05,0);[[.62,.65],[.62,-.65],[-.62,.65],[-.62,-.65]].forEach(([x,z])=>rbox(cab,.08,1.6,.08,.03,MT.yel,x,.82,z,.01));
  rbox(cab,1.55,.12,1.6,.05,MT.yel,0,1.65,0);box(cab,.02,1.3,1.25,MT.glass,.62,.85,0);box(cab,1.2,1.3,.02,MT.glass,0,.85,.65);box(cab,1.2,1.3,.02,MT.glass,0,.85,-.65);box(cab,.02,1.3,1.25,MT.glass,-.62,.85,0);
  const drv=operator(cab,0,.1,0);drv.rotation.y=Math.PI;beacon(st,cab,.3,1.72,.4);
  st.wheels=[];[1,-1].forEach(s=>{st.wheels.push(tire(m,.78,.48,-.95,.78,s*.95,MT.yel,s),tire(m,.5,.34,1.4,.5,s*.88,MT.yel,s));fender(m,.9,.55,-.95,.78,s*.97,MT.yelD,Math.PI*.6);});
  // front loader bucket
  const la=grp(m,.6,1.35,0);[.62,-.62].forEach(z=>beam(la,new V3(0,0,z),new V3(2.2,-.75,z),.13,MT.yel));
  const fb=grp(la,2.25,-.82,0);rbox(fb,.1,.7,2.2,.03,MT.yelD,0,0,0);rbox(fb,.7,.08,2.2,.02,MT.yelD,.3,-.32,0);[1.1,-1.1].forEach(z=>ext(fb,[[0,.35],[0,-.35],[.7,-.35]],0,.05,MT.yelD,0,0,z,.01));
  // backhoe at the rear, with its stabiliser legs
  const legs=[1,-1].map(s=>{const g=grp(m,-1.85,.95,s*.75);rod(g,new V3(0,0,0),new V3(0,-.2,s*.5),.08,MT.yel);const foot=grp(g,0,0,s*.5);rbox(foot,.3,.08,.4,.02,MT.dark,0,-.1,0);g.userData.foot=foot;return g;});
  const sw=grp(m,-2.05,1.1,0);cylY(sw,.18,.4,MT.dark,0,0,0,12);sw.rotation.y=Math.PI;
  const boom=grp(sw,0,.15,0);ext(boom,[[-.05,.12],[1.2,1.0],[2.3,.85],[2.35,.55],[1.2,.7],[-.05,-.12]],.06,.24,MT.yel,0,0,0,.02);
  const stick=grp(boom,2.3,.7,0);ext(stick,[[-.15,.15],[1.6,.06],[1.65,-.08],[-.1,-.12]],.04,.2,MT.yel,0,0,0,.02);
  const bk=grp(stick,1.65,0,0);const ob=arc(.25,-.2,.4,118,-60,10),ib=arc(.25,-.2,.33,-60,118,10);ext(bk,ob.concat(ib),0,.6,MT.yelD,0,0,0,.01);
  const ball=add(bk,ICO,C.dirt,.25,-.2,0);ball.scale.setScalar(.25);ball.visible=false;
  const setArm=(a,b,c)=>{boom.rotation.z=a;stick.rotation.z=b;bk.rotation.z=c;};
  const REST=[1.2,-2.6,-1.4];setArm(...REST);
  st.links=[hydraulic(sw,anchor(sw,.1,.05,0),anchor(boom,1.0,.15,0),{barrel:.6,rb:.07}),hydraulic(boom,anchor(boom,1.4,1.05,0),anchor(stick,-.1,.15,0),{barrel:.55,rb:.06})];
  // the trench along the sidewalk, the pipe, the dirt pile
  const tr=grp(S,0,0,TZ);const TG=new THREE.BoxGeometry(1,.06,.9);TG.translate(-.5,0,0);const trench=add(tr,TG,0x24160f,-2.6,.03,0);trench.scale.x=.001;
  const lip=add(tr,TG,0x8a5634,-2.6,.02,0);lip.scale.set(.001,1,1.6);
  const pipe=cylX(tr,.22,5.2,std(0x2f7de0,.5,.1),-5.2,.1,0,14);pipe.visible=false;
  const pl=pile(S,-4.2,-3.5,.01);
  part(st,'bras','le bras qui creuse',anchor(stick,.8,.3,0),true);
  part(st,'bequilles','les béquilles',anchor(legs[0].userData.foot,0,.2,0),false);
  part(st,'godet','le godet de devant',anchor(fb,.3,.5,1.0),true);
  part(st,'tranchee','la tranchée',anchor(tr,-4.5,.3,0),false);
  part(st,'tuyau','le tuyau',anchor(tr,-5.2,.5,0),false);
  st.focus=new V3(-2.6,1.2,-1.4);st.size={w:12.5,h:7};st.tagAt=anchor(m,0,3.6,0);
  st.update=()=>{st.links.forEach(l=>l.update());};
  const swTo=(a,d)=>to(sw.rotation,'y',a,d);
  const pose=(p,d)=>{const f=[boom.rotation.z,stick.rotation.z,bk.rotation.z];return tw(d,k=>setArm(f[0]+(p[0]-f[0])*k,f[1]+(p[1]-f[1])*k,f[2]+(p[2]-f[2])*k));};
  st.action=async function(){
    if(st.done){await Promise.all([step('On creuse une nouvelle tranchée.','tranchee'),tw(.8,k=>{trench.scale.x=Math.max(.001,trench.scale.x*(1-k));lip.scale.x=trench.scale.x;pl.scale.setScalar(Math.max(.01,pl.scale.x*(1-k)));})]);pipe.visible=false;st.done=false;}
    engineOn(60);
    await Promise.all([step('Les béquilles se posent par terre, pour ne pas bouger.','bequilles'),...legs.map(l=>to(l.position,'y',.75,1.0)),to(fb.rotation,'z',.5,1.0)]);
    for(let i=0;i<2;i++){
      await Promise.all([i?sleep(0):step('Le bras arrière plonge, et creuse une tranchée.','bras'),swTo(Math.PI-.71,1.0),pose([.2,-1.3,-.4],1.4)]);
      await Promise.all([pose([.35,-2.1,-1.6],1.2),tw(1.2,k=>{const L=Math.min(5.2,trench.scale.x+1.4*k/1.2*.9);trench.scale.x=Math.max(trench.scale.x,L);lip.scale.x=trench.scale.x;})]);
      ball.visible=true;
      await Promise.all([pose([1.1,-2.3,-1.5],1.0),swTo(Math.PI-1.02,1.0)]);
      await Promise.all([i?sleep(0):step('Et hop, la terre va sur le tas.','bras'),pose([.8,-1.4,.6],.6).then(()=>{ball.visible=false;thud();for(let k=0;k<8;k++)throwClod(wp(bk),wp(pl,.3));const s0=pl.scale.x;return tw(.7,k=>pl.scale.setScalar(Math.max(.01,s0+(.45+.25*i-s0)*k)));})]);
    }
    trench.scale.x=5.2;lip.scale.x=5.2;
    await Promise.all([swTo(Math.PI,1.2),pose(REST,1.2)]);
    pipe.visible=true;pop(pipe,.6);ding();
    await step("On pose un gros tuyau dedans : c'est pour l'eau des maisons.",'tuyau');
    await Promise.all([step('La tranchée est prête. On relève les béquilles.','bequilles'),...legs.map(l=>to(l.position,'y',.95,.8)),to(fb.rotation,'z',0,.8)]);
    st.done=true;
  };
})();

/* ---- pompe à béton ---- */
(function(){
  const st=makeStation('pompe'),S=st.g,m=grp(S);st.m=m;
  [.42,-.42].forEach(z=>rbox(m,6.6,.3,.16,.03,MT.black,-.4,.97,z));
  const cab=truckCab(m,MT.white,1.45);[1.11,-1.11].forEach(z=>rbox(cab,1.62,.14,.02,.01,MT.red,.8,.75,z,.005));
  st.wheels=[];[1,-1].forEach(s=>{st.wheels.push(tire(m,.55,.4,2.3,.55,s*.9,MT.grey));[-1.0,-2.1,-3.2].forEach(x=>st.wheels.push(tire(m,.55,.3,x,.55,s*.95,MT.grey,s)));fender(m,.66,.48,2.3,.55,s*.92,MT.black);});
  rbox(m,4.4,.5,2.0,.08,MT.red,-1.4,1.4,0);rbox(m,1.2,.9,1.6,.08,MT.grey,-3.4,1.6,0);
  const hopper=add(m,new THREE.CylinderGeometry(.55,.3,.6,12,1,true),std(0x8f96a6,.5,.4,{side:THREE.DoubleSide}),-4.1,1.9,0);
  // outrigger legs
  const legs=[[.6,1],[.6,-1],[-3.2,1],[-3.2,-1]].map(([x,s])=>{const g=grp(m,x,1.25,s*.95);const arm=grp(g);rbox(arm,.25,.25,1.0,.04,MT.red,0,0,s*.5);const foot=grp(arm,0,0,s*1.0);rbox(foot,.18,1.1,.18,.04,MT.dark,0,-.55,0);rbox(foot,.5,.08,.5,.02,MT.dark,0,-1.15,0);arm.scale.z=.3;foot.position.y=.5;return {arm,foot};});
  // turret and the three-part boom, folded on top of the truck
  const tur=grp(m,-1.5,1.65,0);cylY(tur,.5,.5,MT.red,0,.25,0,16);
  const b1=grp(tur,0,1.4,0),b2=grp(b1,4.6,.32,0),b3=grp(b2,4.3,-.3,0);
  [[b1,4.6,.34],[b2,4.3,.28],[b3,3.8,.22]].forEach(([g,L,t])=>{rbox(g,L,t,t,.04,MT.red,L/2,0,0);cylY(g,.08,L,MT.steel,L/2,t/2+.05,0,8).rotation.z=Math.PI/2;cylZ(g,t*.7,t+.1,MT.dark,0,0,0,10);});
  const hose=grp(b3,3.8,0,0);const hoseM=cylY(hose,.1,1.4,MT.black,0,-.7,0,10);
  // the concrete going into the top floor of the block of flats
  S.updateMatrixWorld(true);const target=S.worldToLocal(new V3(...(()=>{const [x,z]=Q(-29,-22);return [x,10.2,z];})()));
  const fG=new THREE.BoxGeometry(5.2,1,3.6);fG.translate(0,.5,0);const fill=add(S,fG,mat(C.wet),target.x,10.05,target.z);fill.scale.y=.01;fill.rotation.y=-YAW+YAW;
  const SG=new THREE.CylinderGeometry(.12,.18,1,8);SG.translate(0,-.5,0);const stream=add(S,SG,C.wet,0,0,0);stream.visible=false;
  st.fill=0;
  // boom pose: [turret yaw, b1, b2, b3] angles
  const FOLD=[0,0,Math.PI,-Math.PI];
  const setBoom=(p)=>{tur.rotation.y=p[0];b1.rotation.z=p[1];b2.rotation.z=p[2];b3.rotation.z=p[3];};
  setBoom([0,.06,Math.PI-.08,-Math.PI+.12]);hose.rotation.z=-.1;
  // solve the boom so the hose hangs above the target
  part(st,'bequilles','les béquilles',anchor(legs[0].foot,0,0,0),false);
  part(st,'bras','le grand bras',anchor(b2,2,.6,0),true);
  part(st,'tuyau','le tuyau',anchor(hose,0,-.6,0),false);
  part(st,'dalle','le plancher',anchor(S,target.x,11.2,target.z),false);
  part(st,'tremie','la trémie',anchor(m,-4.1,2.4,.5),true);
  st.focus=new V3(-2,6.5,-3.5);st.size={w:17,h:17};st.tagAt=anchor(m,0,4.4,0);
  st.update=()=>{fill.scale.y=Math.max(.01,st.fill*.35);if(stream.visible){const p=S.worldToLocal(wp(hose,0).add(new V3(0,-1.35,0)));stream.position.copy(p);stream.scale.y=Math.max(.01,p.y-10.1-st.fill*.35);}};
  // IK for the two outer sections, with the first one steep
  function poseFor(){
    S.updateMatrixWorld(true);const base=S.worldToLocal(tur.getWorldPosition(new V3()));base.y+=1.4;
    const dx=target.x-base.x,dz=target.z-base.z,yaw=Math.atan2(-dz,dx),R=Math.hypot(dx,dz),Hh=target.y+2.6-base.y;
    const a1=1.25,p1x=4.6*Math.cos(a1),p1y=4.6*Math.sin(a1);let tx=R-p1x,ty=Hh-p1y;const L2=4.3,L3=3.8,D=Math.min(L2+L3-.01,Math.hypot(tx,ty));
    const c3=(D*D-L2*L2-L3*L3)/(2*L2*L3),q3=-Math.acos(clamp(c3,-1,1)),q2=Math.atan2(ty,tx)-Math.atan2(L3*Math.sin(q3),L2+L3*Math.cos(q3));
    return [yaw,a1,q2-a1,q3];
  }
  st.action=async function(){
    if(st.fill>=1){await Promise.all([step('Le plancher est sec. On en coule un autre !','dalle'),to(st,'fill',0,1)]);}
    engineOn(70);
    await Promise.all([step('Les béquilles se déplient pour que le camion ne tombe pas.','bequilles'),...legs.map(l=>Promise.all([to(l.arm.scale,'z',1,1.2),to(l.foot.position,'y',0,1.2)]))]);
    const P=poseFor(),P0=[tur.rotation.y,b1.rotation.z,b2.rotation.z,b3.rotation.z];
    await Promise.all([step('Le grand bras se déplie, comme un serpent.','bras'),tw(4,k=>setBoom(P0.map((v,i)=>v+(P[i]-v)*k)),easeSine),tw(4,()=>{hose.rotation.z=-(b1.rotation.z+b2.rotation.z+b3.rotation.z);},lin)]);
    stream.visible=true;
    await Promise.all([step('Le béton monte dans le tuyau, et coule tout en haut de l’immeuble.','tuyau'),to(st,'fill',1,4.2,lin)]);
    stream.visible=false;
    await Promise.all([step('Le plancher du nouvel étage est coulé !','dalle'),sleep(.6)]);
    await Promise.all([step('On replie le bras pour repartir.','bras'),tw(3.2,k=>{setBoom(P.map((v,i)=>v+(P0[i]-v)*k));hose.rotation.z=-(b1.rotation.z+b2.rotation.z+b3.rotation.z);},easeSine)]);
    await Promise.all(legs.map(l=>Promise.all([to(l.arm.scale,'z',.3,1),to(l.foot.position,'y',.5,1)])));
  };
})();

    buildLife(scene,onUpdate,ctx.stations);
  }
};

/* ================= scenery ================= */
const SM={
  cream:std(0xf3e2c6,.8,0), peach:std(0xf2b48c,.8,0), mint:std(0xa8dcc0,.8,0), sky:std(0x9cc8f0,.8,0), lilac:std(0xc8b6ea,.8,0),
  roofR:std(0xd0563a,.7,0), roofG:std(0x5a5f78,.75,0), wood:std(0xc89a5a,.8,0), woodD:std(0x8a5a32,.8,0), block:std(0xa8aab6,.9,0),
  door:std(0x6a3f2a,.7,0), hedge:std(0x3f8f5a,.9,0), grass:std(0x6fae62,.95,0), curb:std(0xd8d6e6,.9,0), slab:std(0xbfc1cc,.9,0),
  heras:std(0xc8ccd8,.5,.5), feet:std(0x3a3f55,.8,0), toilet:std(0x2f7de0,.6,0), cont:std(0x2f9a6a,.7,.1), contR:std(0xd8402a,.7,.1)
};
// group at layout coords (h,d): local +x = towards screen-right, local +z = towards the front
function at(p,h,d,yaw=YAW){const [x,z]=Q(h,d);const g=grp(p,x,0,z);g.rotation.y=yaw;return g;}

/** A house at its stage of construction: 0 slab, 1 walls, 2 roof frame, 3 finished. Front (door) faces local +x. */
function house(p,h,d,yaw,stage,wallM,roofM){
  const g=at(p,h,d,yaw),W=4.6,D=5.2,H=2.6;
  rbox(g,W+.6,.3,D+.6,.05,SM.slab,0,.15,0);
  if(stage===0){for(let x=-2;x<=2;x+=1)rod(g,new V3(x,.3,-2.4),new V3(x,1.2,-2.4),.03,MT.dark,4);
    rbox(g,1.2,.8,1.0,.04,SM.block,1.2,.7,1.2);rbox(g,1.3,.1,1.1,.02,MT.wood,1.2,.25,1.2);shadows(g);return g;}
  const m=stage===3?wallM:SM.block;
  // four walls with a door and window holes
  rbox(g,.25,H,D,.03,m,-W/2,.3+H/2,0);rbox(g,W,H,.25,.03,m,0,.3+H/2,D/2);rbox(g,W,H,.25,.03,m,0,.3+H/2,-D/2);
  rbox(g,.25,H,1.7,.03,m,W/2,.3+H/2,-1.75);rbox(g,.25,H,1.4,.03,m,W/2,.3+H/2,1.9);rbox(g,.25,.6,2.1,.03,m,W/2,.3+H-.3,.15);
  if(stage===3){
    box(g,.08,1.9,1.1,SM.door,W/2+.06,1.25,.1);sph(g,.05,MT.chrome,W/2+.12,1.25,.5);
    [[-1.75],[1.9]].forEach(([z])=>{rbox(g,.12,1.0,1.0,.02,MT.white,W/2+.05,1.75,z,.01);box(g,.06,.8,.8,MT.glassD,W/2+.1,1.75,z);});
    [[-1],[1]].forEach(([x])=>{rbox(g,1.0,1.0,.12,.02,MT.white,x,1.75,D/2+.05,.01);box(g,.8,.8,.06,MT.glassD,x,1.75,D/2+.1);});
  } else if(stage===1){for(let i=0;i<4;i++)rbox(g,.5,.25,.3,.02,SM.block,rnd(-1.5,1.5),.42,rnd(-1.5,1.5),.01);}
  const ry=.3+H;
  if(stage===2){
    for(let z=-D/2;z<=D/2+.01;z+=.65){rod(g,new V3(-W/2-.3,ry,z),new V3(0,ry+1.9,z),.06,SM.wood,5);rod(g,new V3(W/2+.3,ry,z),new V3(0,ry+1.9,z),.06,SM.wood,5);}
    rod(g,new V3(0,ry+1.9,-D/2-.3),new V3(0,ry+1.9,D/2+.3),.08,SM.woodD,6);
  }
  if(stage===3){
    ext(g,[[-W/2-.45,-.05],[W/2+.45,-.05],[0,1.95]],.05,D+.7,roofM,0,ry,0,.03);
    rbox(g,.5,1.1,.5,.04,SM.block,-1,ry+1.4,-1.3);
  }
  shadows(g);return g;
}
/** A garden around a finished house: hedge, a small tree, a path. */
function garden(p,h,d,yaw){
  const g=at(p,h,d,yaw);
  rbox(g,8.2,.08,8.2,.02,SM.grass,-.4,.04,0,.01);
  [[-4.4,0,.3,8.2],[ -.4,4.05,8.0,.3],[-.4,-4.05,8.0,.3]].forEach(([x,z,w,dd])=>rbox(g,w,.55,dd,.12,SM.hedge,x,.3,z));
  rbox(g,1.2,.06,1.0,.02,SM.slab,3.3,.08,.1,.01);
  const t=grp(g,-3,0,2.8);cylY(t,.12,1.3,0x6a4a32,0,.65,0,8);sph(t,.75,std(pick([0x5aa85a,0xf7b6cf,0xf2b21c]),.9,0),0,1.7,0);
  shadows(g);return g;
}
/** Block of flats: `built` floors finished, then bare concrete floors, columns and rebar on top. Front faces +z. */
function flats(p,h,d,floors,built,W,D,wallM){
  const g=at(p,h,d),FH=2.4;
  for(let f=0;f<floors;f++){
    const y=.3+f*FH;rbox(g,W,.25,D,.03,SM.slab,0,y-.12,0);
    if(f<built){rbox(g,W-.1,FH-.25,D-.1,.03,wallM,0,y+FH/2-.1,0);
      for(let x=-W/2+1.2;x<W/2-.6;x+=1.8){rbox(g,1.0,1.1,.1,.02,MT.white,x,y+1.1,D/2,.01);box(g,.8,.9,.05,MT.glassD,x,y+1.1,D/2+.04);}}
    else [[-1,-1],[-1,1],[1,-1],[1,1],[0,-1],[0,1]].forEach(([a,b])=>rbox(g,.35,FH-.25,.35,.03,SM.slab,a*(W/2-.3),y+FH/2-.1,b*(D/2-.3),.01));
  }
  const top=.3+floors*FH;rbox(g,W,.25,D,.03,SM.slab,0,top-.12,0);
  for(let x=-W/2+.4;x<W/2;x+=.8)[-D/2+.3,D/2-.3].forEach(z=>rod(g,new V3(x,top,z),new V3(x,top+.9,z),.025,std(0x8a4a2a,.6,.3),4));
  // scaffolding on the front
  const sz=D/2+.8;
  for(let x=-W/2;x<=W/2+.01;x+=2)[sz,sz+.9].forEach(z=>rod(g,new V3(x,0,z),new V3(x,top,z),.04,MT.steel,5));
  for(let y=1.2;y<top;y+=FH){rbox(g,W,.06,.9,.02,MT.wood,0,y,sz+.45,.01);rod(g,new V3(-W/2,y+1,sz+.9),new V3(W/2,y+1,sz+.9),.025,MT.yel,4);}
  shadows(g);return g;
}
/** Heras fence panels between two layout points (a gap is left where `gaps` says). */
function heras(p,a,b,gaps=[]){
  const tex=(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.clearRect(0,0,64,64);
    x.strokeStyle='#e6e9f2';x.lineWidth=2;for(let i=0;i<=64;i+=8){x.beginPath();x.moveTo(i,0);x.lineTo(i,64);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(64,i);x.stroke();}
    x.lineWidth=8;x.strokeRect(0,0,64,64);const t=new THREE.CanvasTexture(c);return t;})();
  const L=2.4,dh=b[0]-a[0],dd=b[1]-a[1],len=Math.hypot(dh,dd),n=Math.floor(len/L),list=[];
  for(let i=0;i<n;i++){const t=(i+.5)/n,h=a[0]+dh*t,d=a[1]+dd*t;if(gaps.some(([g0,g1])=>t>=g0&&t<=g1))continue;list.push([h,d]);}
  const ang=Math.atan2(dd,dh); // in layout space
  const plane=new THREE.PlaneGeometry(L-.05,1.9);plane.translate(0,1.1,0);
  const pm=new THREE.InstancedMesh(plane,toonMat({map:tex,transparent:true,alphaTest:.4,side:THREE.DoubleSide}),list.length);
  const fm=new THREE.InstancedMesh(UB,SM.feet,list.length*2);
  const ry=YAW-ang;
  list.forEach(([h,d],i)=>{const [x,z]=Q(h,d);dummy.position.set(x,0,z);dummy.rotation.set(0,ry,0);dummy.scale.set(1,1,1);dummy.updateMatrix();pm.setMatrixAt(i,dummy.matrix);
    [-1,1].forEach((s,j)=>{const [fx,fz]=Q(h+Math.cos(ang)*s*L/2,d+Math.sin(ang)*s*L/2);dummy.position.set(fx,.08,fz);dummy.scale.set(.6,.16,.25);dummy.updateMatrix();fm.setMatrixAt(i*2+j,dummy.matrix);});});
  pm.castShadow=true;fm.castShadow=true;p.add(pm);p.add(fm);
}
function bricks(p,h,d,yaw=YAW){const g=at(p,h,d,yaw);rbox(g,1.3,.14,1.1,.02,MT.wood,0,.07,0,.01);rbox(g,1.2,.75,1.0,.02,MT.brick,0,.52,0,.01);shadows(g);return g;}
function rebar(p,h,d,yaw=YAW){const g=at(p,h,d,yaw);[-1.2,1.2].forEach(x=>rbox(g,.2,.2,1.2,.03,MT.wood,x,.1,0));for(let i=0;i<9;i++)rod(g,new V3(-2.4,.25+(i%3)*.06,-.4+i*.1),new V3(2.4,.25+(i%3)*.06,-.4+i*.1),.03,std(0x8a4a2a,.6,.3),4);shadows(g);return g;}
function container(p,h,d,yaw,m){const g=at(p,h,d,yaw);rbox(g,6,2.5,2.4,.06,m,0,1.3,0);for(let x=-2.8;x<=2.8;x+=.4)box(g,.06,2.3,2.46,m,x,1.3,0);rbox(g,6.05,.12,2.45,.03,MT.dark,0,.06,0);shadows(g);return g;}
function toilet(p,h,d,yaw=YAW){const g=at(p,h,d,yaw);rbox(g,1.1,2.2,1.1,.08,SM.toilet,0,1.1,0);rbox(g,1.2,.12,1.2,.05,MT.white,0,2.25,0);box(g,.06,1.8,.8,std(0x2560c0,.6,0),.56,1.0,0);shadows(g);return g;}
function treeAt(p,h,d,cols){const [x,z]=Q(h,d);return autumnTree(p,x,z,cols||pick([[0xf2b21c,0xe8901e,0xf6cf3a],[0xe8721e,0xd13f1f,0xf2a12a],[0x6fbf5a,0x4f9f4a,0x8fd06a]]));}
function lampAt(p,h,d,face){const [x,z]=Q(h,d);return lamp(p,x,z,YAW+(face||0));}
function workerAt(p,h,d,face){const [x,z]=Q(h,d);return worker(p,x,z,YAW+face);}
function tuftField(p,spots){
  const TUFT=new THREE.ConeGeometry(.13,.85,4);TUFT.translate(0,.42,0);const pts=[];
  spots.forEach(([h,d,r,n])=>{for(let i=0;i<n;i++){const a=rnd(0,6.28),rr=Math.sqrt(Math.random())*r;pts.push(Q(h+Math.cos(a)*rr,d+Math.sin(a)*rr));}});
  instanced(p,TUFT,pts.length,(i,dm)=>{dm.position.set(pts[i][0],0,pts[i][1]);dm.rotation.set(rnd(-.35,.35),rnd(0,3),rnd(-.35,.35));const s=rnd(.7,1.4);dm.scale.set(s,s*rnd(.8,1.4),s);return pick([0x4c78ff,0x355fe0,0x6a8fff,0x2c4fc4,0x82a2ff]);});
}

function buildScenery(scene){
  // main road curbs, sidewalks lamps and trees
  { const g=at(scene,0,4);[-2.85,2.85].forEach(z=>rbox(g,92,.16,.25,.04,SM.curb,0,.08,z,.01)); }
  for(let h=-36;h<=36;h+=12){lampAt(scene,h,-.2,Math.PI/2);lampAt(scene,h+6,8.2,-Math.PI/2);}
  [-20,-8,30,38].forEach(h=>treeAt(scene,h,-1));[-30,-22,-2,2,36].forEach(h=>treeAt(scene,h,9.6));
  // zebra crossings are painted; site fences along the road with gates
  heras(scene,[-38,-2],[38,-2],[[.28,.42],[.52,.6],[.7,.82]]);
  heras(scene,[1,9.8],[34,9.8],[[.15,.42]]);
  heras(scene,[-38,9.8],[-17,9.8],[]);
  // ---- back left: block of flats and the crane's yard ----
  flats(scene,-29,-22,4,2,8,6,SM.peach);
  bricks(scene,-19,-12.6);bricks(scene,-17.4,-12.6);rebar(scene,-34,-9.6);
  pipes(scene,...Q(-9,-12),YAW);
  workerAt(scene,-21,-15.4,-.6);workerAt(scene,-23,-9,.9);
  // ---- back right: the dig ----
  [[13,-27],[30,-25],[31,-15]].forEach(([h,d])=>pile(scene,...Q(h,d),.9));
  [[14,-14.5],[20,-14.2]].forEach(([h,d])=>barrier(scene,...Q(h,d),YAW));
  [[11.5,-15],[22.5,-14.6],[29,-20]].forEach(([h,d])=>cone(scene,...Q(h,d)));
  workerAt(scene,23,-26,2.4);workerAt(scene,10,-18,-1.2);
  // ---- front left: the new street of the housing estate ----
  { const g=at(scene,-14,21,YAWF);[-2.35,2.35].forEach(z=>rbox(g,30,.16,.25,.04,SM.curb,0,.08,z,.01)); }
  // right side of the street (h −8): houses at every stage, facing the street
  house(scene,-6.5,12,Math.PI+YAW,3,SM.cream,SM.roofR);garden(scene,-6.5,12,Math.PI+YAW);
  house(scene,-6.5,21,Math.PI+YAW,2,SM.mint,SM.roofG);
  house(scene,-6.5,30,Math.PI+YAW,1,SM.sky,SM.roofR);
  // left side: one finished house at the front, the lot being levelled further back
  house(scene,-21.5,30,YAW,3,SM.lilac,SM.roofG);garden(scene,-21.5,30,YAW);
  house(scene,-23,22.5,YAW,0,SM.cream,SM.roofR);
  workerAt(scene,-9.5,21,Math.PI);
  [[-11.5,8.6],[-16.5,8.6],[-11.4,34],[-16.6,34]].forEach(([h,d])=>cone(scene,...Q(h,d)));
  lampAt(scene,-17,15,0);lampAt(scene,-11,28,Math.PI);
  // ---- front right: the site base ----
  [0,1].forEach(k=>{const [x,z]=Q(6,26);const o=office(scene,x,z,YAW+Math.PI/2);o.position.y=k*2.75;});
  { const [x,z]=Q(9.5,22);office(scene,x,z,YAW); }
  toilet(scene,12.6,26.5);toilet(scene,12.6,28);
  container(scene,30,8.8,YAW,SM.cont);container(scene,32,-2.5,YAWF,SM.contR);
  [[16,27,'car'],[19,27.5,'van'],[22,27,'car']].forEach(([h,d,k],i)=>{const c=miniCar(scene,k);const [x,z]=Q(h,d);c.position.set(x,0,z);c.rotation.y=YAW+Math.PI/2+(i-1)*.05;});
  rebar(scene,26,25,YAWF);bricks(scene,29,22);bricks(scene,30.4,21.4);
  workerAt(scene,10,18.5,1.4);
  // grass and gardens, a few more trees at the edges
  tuftField(scene,[[-24,36,4,40],[-2,34,5,40],[36,14,4,30],[-38,4,3,20],[38,-10,4,30],[-36,-6,3,20],[-4,-34,5,40],[18,-34,4,30],[2,16,3,20],[-30,26,4,30]]);
  [[-2,36],[4,33],[36,17],[-36,-2],[-8,-36],[22,-34],[-37,19],[35,-15],[0,15]].forEach(([h,d])=>treeAt(scene,h,d));
}

/* ================= life ================= */
function buildLife(scene,onUpdate){
  const all=[];
  // traffic on the main road: two lanes, a U-turn hidden in the trees at each end
  const road=route([[-43,2.8],[0,2.8],[43,2.8],[45.5,4],[43,5.2],[0,5.2],[-43,5.2],[-45.5,4]],true,.1);
  const cars=['truck','car','van','taxi','truck','car','kei','car'].map(k=>miniCar(scene,k));all.push(...cars);
  const tr=traffic(road,cars,4.2,{gap:4.2});
  // people on the sidewalks, crossing at the zebras
  const walk=route([[-33,.4],[33,.4],[33,7.6],[-33,7.6]],true,.05);
  const folks=[0,1,2,3,4,5].map(i=>person(scene,0,0,{kid:i===2}));all.push(...folks);
  const tw2=traffic(walk,folks,1.1,{gap:1.4});
  // workers walking about the site
  const loops=[
    route([[4,23.5],[12,23.2],[13,31.5],[3.5,31.8]],true,.2),
  ];
  const crews=loops.map((r,i)=>{const ps=[0,1].map(()=>person(scene,0,0,{vest:true,hat:i===1?MT.white:MT.hat}));all.push(...ps);return traffic(r,ps,.9,{gap:1.2});});
  onUpdate(dt=>{tr.update(dt,all);tw2.update(dt,all);crews.forEach(c=>c.update(dt,all));});
}
